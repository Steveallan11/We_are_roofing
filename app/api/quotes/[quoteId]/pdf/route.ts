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
      message: "PDF generation preview completed.",
      pdf_url: null
    });
  }

  const supabase = createSupabaseAdminClient();
  const { data: quote, error } = await supabase.from("quotes").select("*").eq("id", quoteId).single();
  if (error || !quote) {
    return NextResponse.json({ ok: false, error: error?.message ?? "Quote not found." }, { status: 404 });
  }

  const bundle = await getJobBundle(quote.job_id);
  if (!bundle) {
    return NextResponse.json({ ok: false, error: "Related job not found." }, { status: 404 });
  }

  const artifacts = await persistQuoteArtifacts(supabase, { ...bundle, quote }, quote);
  return NextResponse.json({
    ok: true,
    message: artifacts.pdfUrl ? "PDF document regenerated." : "Document snapshot regenerated, but no public PDF URL is available yet.",
    pdf_url: artifacts.pdfUrl,
    html_url: artifacts.htmlUrl
  });
}
