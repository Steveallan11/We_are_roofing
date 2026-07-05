import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/auth";
import { getInvoicePdfHref } from "@/lib/documents";
import { verifyInvoiceFileToken } from "@/lib/invoices/publicLink";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type Props = {
  params: Promise<{ invoiceId: string }>;
};

const DEFAULT_SIGNED_URL_TTL_SECONDS = 60 * 60;
const PUBLIC_LEGACY_STATUSES = new Set(["Sent", "Part Paid", "Paid", "Overdue"]);

export async function GET(request: Request, { params }: Props) {
  const { invoiceId } = await params;
  const supabase = createSupabaseAdminClient();
  const token = new URL(request.url).searchParams.get("token");
  const { data: invoice } = await supabase.from("invoices").select("pdf_url,status").eq("id", invoiceId).maybeSingle();
  const hasPublicToken = verifyInvoiceFileToken(invoiceId, token);
  const hasLegacyPublicAccess = !token && invoice?.status && PUBLIC_LEGACY_STATUSES.has(String(invoice.status));

  if (!hasPublicToken && !hasLegacyPublicAccess) {
    const auth = await requireAdminApi();
    if (!auth.ok) return auth.response;
  }

  const { data: document, error } = await supabase
    .from("job_documents")
    .select("*")
    .eq("invoice_id", invoiceId)
    .eq("document_type", "invoice_pdf")
    .limit(1)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  if (document?.storage_bucket && document.storage_path) {
    const signed = await supabase.storage.from(document.storage_bucket).createSignedUrl(document.storage_path, DEFAULT_SIGNED_URL_TTL_SECONDS);
    if (signed.error || !signed.data?.signedUrl) {
      return NextResponse.json({ ok: false, error: signed.error?.message ?? "Could not open the invoice PDF." }, { status: 500 });
    }

    return NextResponse.redirect(signed.data.signedUrl);
  }

  if (invoice?.pdf_url && invoice.pdf_url !== getInvoicePdfHref(invoiceId)) {
    return NextResponse.redirect(invoice.pdf_url);
  }

  return NextResponse.json({ ok: false, error: "Invoice PDF not found." }, { status: 404 });
}
