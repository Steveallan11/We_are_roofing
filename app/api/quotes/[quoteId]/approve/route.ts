import { NextResponse } from "next/server";
import { getJobBundle } from "@/lib/data";
import { persistQuoteArtifacts } from "@/lib/quote-engine";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { canPersistToSupabase } from "@/lib/workflows";

type Props = {
  params: Promise<{ quoteId: string }>;
};

export async function POST(_request: Request, { params }: Props) {
  const { quoteId } = await params;

  if (!canPersistToSupabase()) {
    return NextResponse.json({
      ok: true,
      quoteId,
      message: "Quote approved.",
      next_job_status: "Ready To Send",
      next_quote_status: "Approved"
    });
  }

  const supabase = createSupabaseAdminClient();
  const { data: quote, error } = await supabase
    .from("quotes")
    .update({
      status: "Approved",
      updated_at: new Date().toISOString()
    })
    .eq("id", quoteId)
    .select("*")
    .single();

  if (error || !quote) {
    return NextResponse.json({ ok: false, error: error?.message ?? "Unable to approve quote." }, { status: 500 });
  }

  const bundle = await getJobBundle(quote.job_id);
  if (bundle) {
    await persistQuoteArtifacts(supabase, { ...bundle, quote }, quote);
  }

  await supabase
    .from("jobs")
    .update({
      status: "Ready To Send",
      updated_at: new Date().toISOString()
    })
    .eq("id", quote.job_id);

  return NextResponse.json({
    ok: true,
    quoteId,
    message: "Quote approved in Supabase.",
    next_job_status: "Ready To Send",
    next_quote_status: "Approved",
    quote
  });
}
