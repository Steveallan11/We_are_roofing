import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { canPersistToSupabase } from "@/lib/workflows";
import type { CostLineItem, QuoteOption } from "@/lib/types";

type Props = {
  params: Promise<{ quoteId: string }>;
};

type QuoteUpdateBody = {
  roof_report?: string;
  scope_of_works?: string;
  cost_breakdown?: Array<{
    item: string;
    cost: number;
    vat_applicable: boolean;
    notes: string;
    quantity?: number;
    unit?: string;
    unit_rate?: number;
    pricing_source?: string;
  }>;
  guarantee_text?: string | null;
  exclusions?: string | null;
  terms?: string | null;
  customer_email_subject?: string | null;
  customer_email_body?: string | null;
  missing_info?: string[];
  pricing_notes?: string[];
  confidence?: "Low" | "Medium" | "High";
  options?: QuoteOption[];
  accepted_option_id?: string | null;
};

export async function PATCH(request: Request, { params }: Props) {
  const { quoteId } = await params;
  const body = (await request.json()) as QuoteUpdateBody;

  const lineItems = body.cost_breakdown ?? [];
  const normalisedOptions = normaliseQuoteOptions(body.options ?? []);
  const subtotal = Math.round(lineItems.reduce((sum, item) => sum + Number(item.cost || 0), 0) * 100) / 100;
  const vatAmount =
    Math.round(
      lineItems
        .filter((item) => item.vat_applicable)
        .reduce((sum, item) => sum + Number(item.cost || 0) * 0.2, 0) * 100
    ) / 100;

  if (!canPersistToSupabase()) {
    return NextResponse.json({
      ok: true,
      quote: {
        id: quoteId,
        ...body,
        options: normalisedOptions,
        subtotal,
        vat_amount: vatAmount,
        total: subtotal + vatAmount
      }
    });
  }

  const supabase = createSupabaseAdminClient();
  const { data: existingQuote, error: existingError } = await supabase.from("quotes").select("job_id").eq("id", quoteId).single();
  if (existingError || !existingQuote) {
    return NextResponse.json({ ok: false, error: existingError?.message ?? "Quote not found." }, { status: 404 });
  }

  const { data: job } = await supabase.from("jobs").select("business_id").eq("id", existingQuote.job_id).single();
  const { data: business } = await supabase.from("businesses").select("vat_rate").eq("id", job?.business_id).maybeSingle();
  const vatRate = Number(business?.vat_rate ?? 20) / 100;
  const recomputedVat =
    Math.round(
      lineItems
        .filter((item) => item.vat_applicable)
        .reduce((sum, item) => sum + Number(item.cost || 0) * vatRate, 0) * 100
    ) / 100;

  const { data: updatedQuote, error } = await supabase
    .from("quotes")
    .update({
      ...body,
      options: normalisedOptions,
      subtotal,
      vat_amount: recomputedVat,
      total: subtotal + recomputedVat,
      updated_at: new Date().toISOString()
    })
    .eq("id", quoteId)
    .select("*")
    .single();

  if (error || !updatedQuote) {
    return NextResponse.json({ ok: false, error: error?.message ?? "Unable to update quote." }, { status: 500 });
  }

  await supabase
    .from("jobs")
    .update({
      estimated_value: updatedQuote.total,
      updated_at: new Date().toISOString()
    })
    .eq("id", existingQuote.job_id);

  return NextResponse.json({ ok: true, quote: updatedQuote });
}

function normaliseQuoteOptions(options: QuoteOption[]) {
  return options.map((option, index) => {
    const costBreakdown = (option.cost_breakdown ?? []).map(normaliseCostLine);
    const totals = calculateTotals(costBreakdown);
    return {
      ...option,
      id: option.id || `option_${index + 1}`,
      label: option.label || `Option ${index + 1}`,
      description: option.description || "",
      recommended: Boolean(option.recommended),
      cost_breakdown: costBreakdown,
      subtotal: totals.subtotal,
      vat_amount: totals.vat_amount,
      total: totals.total
    };
  });
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
