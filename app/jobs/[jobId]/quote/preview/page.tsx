import { notFound } from "next/navigation";
import { DocumentPreviewToolbar } from "@/components/documents/DocumentPreviewToolbar";
import { QuoteDocument } from "@/components/documents/QuoteDocument";
import { AppShell } from "@/components/layout/app-shell";
import { getJobBundle } from "@/lib/data";
import { getQuotePdfHref } from "@/lib/documents";

type Props = {
  params: Promise<{ jobId: string }>;
};

export default async function QuotePreviewPage({ params }: Props) {
  const { jobId } = await params;
  const bundle = await getJobBundle(jobId);
  if (!bundle?.quote) notFound();

  return (
    <AppShell title="Quote Preview" subtitle="Customer-facing preview. Check this before approving, sending, or generating the final PDF." wide>
      <DocumentPreviewToolbar backHref={`/jobs/${jobId}/quote`} pdfHref={getQuotePdfHref(bundle.quote.id)} />
      <QuoteDocument bundle={bundle} quote={bundle.quote} />
    </AppShell>
  );
}
