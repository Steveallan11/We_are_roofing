import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { validatePublicQuoteAccess } from "@/lib/public-quote";
import type { QuoteOption, QuoteRecord } from "@/lib/types";
import { canPersistToSupabase } from "@/lib/workflows";

type Props = {
  params: Promise<{ quoteId: string }>;
};

export async function POST(request: Request, { params }: Props) {
  const { quoteId } = await params;
  const token = new URL(request.url).searchParams.get("token");
  const body = (await request.json().catch(() => ({}))) as { option_id?: string | null };

  if (!canPersistToSupabase()) {
    return NextResponse.json({ ok: true });
  }

  const supabase = createSupabaseAdminClient();
  const { data: quote, error } = await supabase.from("quotes").select("*").eq("id", quoteId).single();
  if (error || !quote) {
    return NextResponse.json({ ok: false, error: error?.message ?? "Quote not found." }, { status: 404 });
  }

  const quoteRecord = quote as QuoteRecord;
  const access = validatePublicQuoteAccess(quoteRecord, token);
  if (!access.ok) {
    return NextResponse.json({ ok: false, error: "Quote link is invalid or has expired." }, { status: 403 });
  }

  const acceptedOption = ((quoteRecord.options ?? []) as QuoteOption[]).find((option) => option.id === body.option_id) ?? null;
  const quoteUpdates: Record<string, unknown> = {
    status: "Accepted",
    accepted_option_id: acceptedOption?.id ?? null,
    updated_at: new Date().toISOString()
  };

  if (acceptedOption) {
    quoteUpdates.cost_breakdown = acceptedOption.cost_breakdown;
    quoteUpdates.subtotal = acceptedOption.subtotal;
    quoteUpdates.vat_amount = acceptedOption.vat_amount;
    quoteUpdates.total = acceptedOption.total;
  }

  const { error: updateError } = await supabase.from("quotes").update(quoteUpdates).eq("id", quoteId);
  if (updateError) {
    return NextResponse.json({ ok: false, error: updateError.message }, { status: 500 });
  }

  await supabase
    .from("jobs")
    .update({ status: "Accepted", accepted_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq("id", quoteRecord.job_id);

  return NextResponse.json({ ok: true, accepted_option_id: acceptedOption?.id ?? null });
}
