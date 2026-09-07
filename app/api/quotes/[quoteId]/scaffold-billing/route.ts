import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/auth";
import { createActivity } from "@/lib/activity/createActivity";
import {
  BILLED_SEPARATELY_DEFAULT_NOTE,
  calculateOptionNet,
  calculateOptionVat,
  getQuotePipelineValue,
  isScaffoldLine,
  normaliseQuoteOption
} from "@/lib/quotes/value";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { CostLineItem, QuoteOption, QuoteRecord } from "@/lib/types";
import { canPersistToSupabase } from "@/lib/workflows";

type Props = { params: Promise<{ quoteId: string }> };

export async function PATCH(request: Request, { params }: Props) {
  const { quoteId } = await params;
  const body = (await request.json().catch(() => ({}))) as { billed_separately?: boolean };
  if (typeof body.billed_separately !== "boolean") {
    return NextResponse.json({ ok: false, error: "Choose whether scaffold is included in our figures." }, { status: 400 });
  }

  if (!canPersistToSupabase()) {
    return NextResponse.json({ ok: true, message: "Scaffold financial treatment preview updated." });
  }

  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  const supabase = createSupabaseAdminClient();
  const lookup = await supabase.from("quotes").select("*").eq("id", quoteId).single();
  if (lookup.error || !lookup.data) {
    return NextResponse.json({ ok: false, error: lookup.error?.message ?? "Quote not found." }, { status: 404 });
  }

  const quote = lookup.data as QuoteRecord;
  let changedCount = 0;
  const updateLines = (lines: CostLineItem[] = []) => lines.map((line) => {
    if (!isScaffoldLine(line)) return line;
    changedCount += 1;
    return {
      ...line,
      billed_separately: body.billed_separately,
      billed_separately_note: body.billed_separately
        ? line.billed_separately_note || BILLED_SEPARATELY_DEFAULT_NOTE
        : line.billed_separately_note
    };
  });

  const costBreakdown = updateLines(quote.cost_breakdown ?? []);
  const options = (quote.options ?? []).map((option: QuoteOption, index: number) =>
    normaliseQuoteOption({ ...option, cost_breakdown: updateLines(option.cost_breakdown ?? []) }, index)
  );
  if (!changedCount) {
    return NextResponse.json({ ok: false, error: "No scaffold line was found on this quote." }, { status: 400 });
  }

  const subtotal = calculateOptionNet({ cost_breakdown: costBreakdown });
  const vatAmount = calculateOptionVat({ cost_breakdown: costBreakdown });
  const projectedQuote: QuoteRecord = {
    ...quote,
    cost_breakdown: costBreakdown,
    options,
    subtotal,
    vat_amount: vatAmount,
    total: subtotal + vatAmount
  };
  const projectedCompanyTotal = getQuotePipelineValue(projectedQuote) ?? 0;
  const invoiceLookup = await supabase
    .from("invoices")
    .select("total,status")
    .eq("quote_id", quote.id)
    .neq("status", "Void");
  if (invoiceLookup.error) {
    return NextResponse.json({ ok: false, error: invoiceLookup.error.message }, { status: 500 });
  }
  const alreadyInvoiced = (invoiceLookup.data ?? []).reduce((sum, invoice) => sum + Number(invoice.total ?? 0), 0);
  if (alreadyInvoiced > projectedCompanyTotal + 0.01) {
    return NextResponse.json(
      {
        ok: false,
        error: `Scaffold cannot be excluded because ${alreadyInvoiced.toLocaleString("en-GB", { style: "currency", currency: "GBP" })} has already been invoiced, which is more than the new company quote value.`
      },
      { status: 400 }
    );
  }

  const update = await supabase
    .from("quotes")
    .update({
      cost_breakdown: costBreakdown,
      options,
      subtotal,
      vat_amount: vatAmount,
      total: subtotal + vatAmount,
      updated_at: new Date().toISOString()
    })
    .eq("id", quoteId)
    .select("*")
    .single();
  if (update.error || !update.data) {
    return NextResponse.json({ ok: false, error: update.error?.message ?? "Scaffold treatment could not be updated." }, { status: 500 });
  }

  const updatedQuote = update.data as QuoteRecord;
  await supabase
    .from("jobs")
    .update({ estimated_value: getQuotePipelineValue(updatedQuote) ?? 0, updated_at: new Date().toISOString() })
    .eq("id", quote.job_id);

  const { data: job } = await supabase.from("jobs").select("business_id,customer_id").eq("id", quote.job_id).single();
  await createActivity(supabase, {
    business_id: job?.business_id ? String(job.business_id) : null,
    job_id: quote.job_id,
    customer_id: job?.customer_id ? String(job.customer_id) : null,
    quote_id: quote.id,
    activity_type: "quote_edited",
    message: body.billed_separately
      ? `Scaffold excluded from company financial totals on ${quote.quote_ref}`
      : `Scaffold included in company financial totals on ${quote.quote_ref}`,
    actor_type: "user",
    actor_id: auth.session.user?.id ?? null,
    actor_name: auth.session.user?.email ?? null,
    linked_entity_type: "quote",
    linked_entity_id: quote.id,
    details: { billed_separately: body.billed_separately, scaffold_lines_updated: changedCount }
  });

  return NextResponse.json({
    ok: true,
    message: body.billed_separately
      ? "Scaffold remains on the customer quote but is now excluded from your financial summary and invoices."
      : "Scaffold is now included in your financial summary and invoices."
  });
}
