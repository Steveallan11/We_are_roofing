import { createActivity } from "@/lib/activity/createActivity";
import { learnPricingFromQuote } from "@/lib/pricing/learning";
import type { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { CostLineItem, QuoteOption, QuoteRecord } from "@/lib/types";

type SupabaseAdmin = ReturnType<typeof createSupabaseAdminClient>;

export type AcceptQuoteParams = {
  quoteId: string;
  optionId?: string | null;
  selectedLineIndexes?: number[];
  actorType: "customer" | "user";
  actorName: string;
  actorId?: string | null;
  customerEmail?: string | null;
  note?: string | null;
};

export type AcceptQuoteResult = { ok: true; accepted_option_id: string | null } | { ok: false; status: number; error: string };

/**
 * Shared by the customer-facing public accept and the internal
 * "mark accepted" action, so both paths move the quote/job/nurture
 * sequence/pricing-learning state in exactly the same way.
 */
export async function acceptQuote(supabase: SupabaseAdmin, params: AcceptQuoteParams): Promise<AcceptQuoteResult> {
  const { data: quote, error } = await supabase.from("quotes").select("*").eq("id", params.quoteId).single();
  if (error || !quote) {
    return { ok: false, status: 404, error: error?.message ?? "Quote not found." };
  }

  const quoteRecord = quote as QuoteRecord;
  if (quoteRecord.status === "Accepted") {
    return { ok: false, status: 400, error: "This quote has already been accepted." };
  }

  const quoteOptions = (quoteRecord.options ?? []) as QuoteOption[];
  const acceptedOption = quoteOptions.find((option) => option.id === params.optionId) ?? null;
  const hasSelectedLineIndexes = Array.isArray(params.selectedLineIndexes) && params.selectedLineIndexes.length > 0;
  if (quoteOptions.length > 0 && !acceptedOption && !hasSelectedLineIndexes) {
    return { ok: false, status: 400, error: "Choose which quote option was accepted." };
  }

  let acceptedTotal = Number(quoteRecord.total ?? 0);
  let acceptedLines = (quoteRecord.cost_breakdown ?? []) as CostLineItem[];
  const quoteUpdates: Record<string, unknown> = {
    status: "Accepted",
    accepted_option_id: acceptedOption?.id ?? null,
    updated_at: new Date().toISOString()
  };

  if (hasSelectedLineIndexes) {
    const allLines = (quoteRecord.cost_breakdown ?? []) as CostLineItem[];
    const selectedIndexes = new Set((params.selectedLineIndexes ?? []).filter((index) => Number.isInteger(index) && index >= 0));
    const selectedLines = allLines.filter((_, index) => selectedIndexes.has(index)).map(normaliseCostLine);
    if (!selectedLines.length) {
      return { ok: false, status: 400, error: "Choose at least one quote section to accept." };
    }
    const selectedTotals = calculateTotals(selectedLines);
    quoteUpdates.cost_breakdown = selectedLines;
    quoteUpdates.subtotal = selectedTotals.subtotal;
    quoteUpdates.vat_amount = selectedTotals.vat_amount;
    quoteUpdates.total = selectedTotals.total;
    acceptedTotal = selectedTotals.total;
    acceptedLines = selectedLines;
  } else if (acceptedOption) {
    const selectedLines = (acceptedOption.cost_breakdown ?? []).map(normaliseCostLine);
    const selectedTotals = calculateTotals(selectedLines);
    quoteUpdates.cost_breakdown = selectedLines;
    quoteUpdates.subtotal = selectedTotals.subtotal;
    quoteUpdates.vat_amount = selectedTotals.vat_amount;
    quoteUpdates.total = selectedTotals.total;
    acceptedTotal = selectedTotals.total;
    acceptedLines = selectedLines;
  }

  const { error: updateError } = await supabase.from("quotes").update(quoteUpdates).eq("id", params.quoteId);
  if (updateError) {
    return { ok: false, status: 500, error: updateError.message };
  }

  // Cancel nurture sequence when quote is accepted
  try {
    await supabase
      .from("nurture_sequences")
      .update({ completed_at: new Date().toISOString(), completion_reason: "quote_accepted" })
      .eq("quote_id", params.quoteId)
      .is("completed_at", null);
  } catch (err) {
    console.error("Failed to cancel nurture sequence on quote acceptance:", err);
  }

  await supabase
    .from("jobs")
    .update({ status: "Accepted", accepted_at: new Date().toISOString(), estimated_value: acceptedTotal, updated_at: new Date().toISOString() })
    .eq("id", quoteRecord.job_id);

  const { data: job } = await supabase.from("jobs").select("business_id, customer_id").eq("id", quoteRecord.job_id).maybeSingle();

  const message =
    params.actorType === "customer"
      ? `${params.actorName} accepted quote ${quoteRecord.quote_ref}`
      : `${quoteRecord.quote_ref} marked accepted by ${params.actorName}${params.note ? ` — ${params.note}` : ""}`;

  await createActivity(supabase, {
    business_id: job?.business_id ? String(job.business_id) : null,
    job_id: quoteRecord.job_id,
    customer_id: job?.customer_id ? String(job.customer_id) : null,
    quote_id: params.quoteId,
    activity_type: "quote_accepted",
    message,
    actor_type: params.actorType,
    actor_id: params.actorId ?? null,
    actor_name: params.actorName,
    linked_entity_type: "quote",
    linked_entity_id: params.quoteId,
    details: {
      customer_email: params.customerEmail ?? null,
      accepted_option_id: acceptedOption?.id ?? null,
      total: acceptedTotal,
      note: params.note ?? null
    }
  });

  if (job?.business_id) {
    const learning = await learnPricingFromQuote({
      supabase,
      businessId: String(job.business_id),
      jobId: quoteRecord.job_id,
      quoteId: params.quoteId,
      lines: acceptedLines,
      sourceType: "quote_accept"
    });

    if (learning.notes.length) {
      const nextNotes = [...new Set([...(Array.isArray(quoteRecord.pricing_notes) ? quoteRecord.pricing_notes : []), ...learning.notes])];
      await supabase.from("quotes").update({ pricing_notes: nextNotes, updated_at: new Date().toISOString() }).eq("id", params.quoteId);
    }
  }

  return { ok: true, accepted_option_id: acceptedOption?.id ?? null };
}

function normaliseCostLine(line: CostLineItem): CostLineItem {
  const quantity = typeof line.quantity === "number" && Number.isFinite(line.quantity) ? line.quantity : undefined;
  const unitRate = typeof line.unit_rate === "number" && Number.isFinite(line.unit_rate) ? line.unit_rate : undefined;
  const cost = quantity != null && unitRate != null ? Math.round(quantity * unitRate * 100) / 100 : Number(line.cost || 0);

  return {
    ...line,
    item: line.item || "Quote item",
    cost,
    vat_applicable: line.vat_applicable !== false,
    notes: line.notes || "",
    quantity,
    unit_rate: unitRate
  };
}

function calculateTotals(lines: CostLineItem[]) {
  const subtotal = Math.round(lines.reduce((sum, line) => sum + Number(line.cost || 0), 0) * 100) / 100;
  const vat_amount = Math.round(lines.filter((line) => line.vat_applicable).reduce((sum, line) => sum + Number(line.cost || 0) * 0.2, 0) * 100) / 100;
  return { subtotal, vat_amount, total: subtotal + vat_amount };
}
