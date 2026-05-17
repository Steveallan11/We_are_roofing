import { NextResponse } from "next/server";
import { getJobBundle } from "@/lib/data";
import { persistInvoiceArtifacts } from "@/lib/invoice-engine";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { InvoiceRecord } from "@/lib/types";
import { canPersistToSupabase } from "@/lib/workflows";

type Props = {
  params: Promise<{ invoiceId: string }>;
};

export async function POST(_request: Request, { params }: Props) {
  const { invoiceId } = await params;

  if (!canPersistToSupabase()) {
    return NextResponse.json({ ok: true, message: "Invoice PDF preview completed.", pdf_url: null });
  }

  const supabase = createSupabaseAdminClient();
  const { data: invoice, error } = await supabase.from("invoices").select("*").eq("id", invoiceId).single();
  if (error || !invoice) {
    return NextResponse.json({ ok: false, error: error?.message ?? "Invoice not found." }, { status: 404 });
  }

  const bundle = await getJobBundle(invoice.job_id);
  if (!bundle) {
    return NextResponse.json({ ok: false, error: "Related job not found." }, { status: 404 });
  }

  const typedInvoice = invoice as InvoiceRecord;
  const artifacts = await persistInvoiceArtifacts(supabase, { ...bundle, invoices: [typedInvoice, ...bundle.invoices] }, typedInvoice);
  if (!artifacts.pdfUrl) {
    return NextResponse.json({ ok: false, error: artifacts.error || "Invoice PDF could not be uploaded." }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    message: "Invoice PDF regenerated.",
    pdf_url: artifacts.pdfUrl,
    html_url: artifacts.htmlUrl
  });
}
