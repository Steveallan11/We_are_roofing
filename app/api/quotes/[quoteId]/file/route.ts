import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getQuotePdfHref } from "@/lib/documents";

type Props = {
  params: Promise<{ quoteId: string }>;
};

const DEFAULT_SIGNED_URL_TTL_SECONDS = 60 * 60;

export async function GET(_request: Request, { params }: Props) {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  const { quoteId } = await params;
  const supabase = createSupabaseAdminClient();
  const { data: document, error } = await supabase
    .from("job_documents")
    .select("*")
    .eq("quote_id", quoteId)
    .eq("document_type", "quote_pdf")
    .limit(1)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  if (document?.storage_bucket && document.storage_path) {
    const signed = await supabase.storage.from(document.storage_bucket).createSignedUrl(document.storage_path, DEFAULT_SIGNED_URL_TTL_SECONDS);
    if (signed.error || !signed.data?.signedUrl) {
      return NextResponse.json({ ok: false, error: signed.error?.message ?? "Could not open the quote PDF." }, { status: 500 });
    }

    return NextResponse.redirect(signed.data.signedUrl);
  }

  const { data: quote } = await supabase.from("quotes").select("pdf_url").eq("id", quoteId).maybeSingle();
  if (quote?.pdf_url && quote.pdf_url !== getQuotePdfHref(quoteId)) {
    return NextResponse.redirect(quote.pdf_url);
  }

  return NextResponse.json({ ok: false, error: "Quote PDF not found." }, { status: 404 });
}
