import { notFound } from "next/navigation";
import { DocumentPreviewToolbar } from "@/components/documents/DocumentPreviewToolbar";
import { InvoiceDocument } from "@/components/documents/InvoiceDocument";
import { AppShell } from "@/components/layout/app-shell";
import { getInvoiceDocumentBundle } from "@/lib/data";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { InvoiceRecord } from "@/lib/types";
import { getInvoicePdfHref } from "@/lib/documents";

export default async function BespokeInvoicePreviewPage({ params }: { params: Promise<{ invoiceId: string }> }) {
  const { invoiceId } = await params;
  const { data } = await createSupabaseAdminClient().from("invoices").select("*").eq("id", invoiceId).single();
  if (!data) notFound();
  const invoice = data as InvoiceRecord;
  const bundle = await getInvoiceDocumentBundle(invoice);
  if (!bundle) notFound();
  return (
    <AppShell title="Invoice Preview" subtitle="Review the customer, items and totals before sending." wide>
      <DocumentPreviewToolbar backHref="/money?tab=invoices" pdfHref={getInvoicePdfHref(invoice.id)} />
      <InvoiceDocument bundle={bundle} invoice={invoice} />
    </AppShell>
  );
}
