import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { canPersistToSupabase } from "@/lib/workflows";

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
  }>;
  guarantee_text?: string | null;
  exclusions?: string | null;
  terms?: string | null;
  customer_email_subject?: string | null;
  customer_email_body?: string | null;
  missing_info?: string[];
  pricing_notes?: string[];
  confidence?: "Low" | "Medium" | "High";
};

export async function PATCH(request: Request, { params }: Props) {
  const { quoteId } = await params;
  const body = (await request.json()) as QuoteUpdateBody;

  const subtotal = Math.round((body.cost_breakdown ?? []).reduce((sum, item) => sum + Number(item.cost || 0), 0) * 100) / 100;
  const vatAmount =
    Math.round(
      (body.cost_breakdown ?? [])
        .filter((item) => item.vat_applicable)
        .reduce((sum, item) => sum + Number(item.cost || 0) * 0.2, 0) * 100
    ) / 100;

  if (!canPersistToSupabase()) {
    return NextResponse.json({
      ok: true,
      quote: {
        id: quoteId,
        ...body,
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
      (body.cost_breakdown ?? [])
        .filter((item) => item.vat_applicable)
        .reduce((sum, item) => sum + Number(item.cost || 0) * vatRate, 0) * 100
    ) / 100;

  const { data: updatedQuote, error } = await supabase
    .from("quotes")
    .update({
      ...body,
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
