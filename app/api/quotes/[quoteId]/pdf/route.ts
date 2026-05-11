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
  if (!artifacts.pdfUrl) {
    return NextResponse.json(
      {
        ok: false,
        error:
          artifacts.pdfError ||
          artifacts.bucketError ||
          "The PDF was built, but it could not be uploaded to the job-documents bucket in Supabase Storage.",
        html_url: artifacts.htmlUrl,
        html_error: artifacts.htmlError,
        pdf_error: artifacts.pdfError,
        bucket_error: artifacts.bucketError
      },
      { status: 500 }
    );
  }

  return NextResponse.json({
    ok: true,
    message: "PDF document regenerated.",
    pdf_url: artifacts.pdfUrl,
    html_url: artifacts.htmlUrl
  });
}
