import { notFound } from "next/navigation";
import { DocumentPreviewToolbar } from "@/components/documents/DocumentPreviewToolbar";
import { InvoiceDocument } from "@/components/documents/InvoiceDocument";
import { AppShell } from "@/components/layout/app-shell";
import { getJobBundle } from "@/lib/data";
import { getInvoicePdfHref } from "@/lib/documents";

type Props = {
  params: Promise<{ jobId: string; invoiceId: string }>;
};

export default async function InvoicePreviewPage({ params }: Props) {
  const { jobId, invoiceId } = await params;
  const bundle = await getJobBundle(jobId);
  const invoice = bundle?.invoices.find((item) => item.id === invoiceId);
  if (!bundle || !invoice) notFound();

  return (
    <AppShell title="Invoice Preview" subtitle="Customer-facing invoice preview. Check this before sending or downloading." wide>
      <DocumentPreviewToolbar backHref={`/jobs/${jobId}`} pdfHref={getInvoicePdfHref(invoice.id)} />
      <InvoiceDocument bundle={bundle} invoice={invoice} />
    </AppShell>
  );
}
