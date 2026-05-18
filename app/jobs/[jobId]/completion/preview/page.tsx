import { notFound } from "next/navigation";
import { CompletionCertificate } from "@/components/documents/CompletionCertificate";
import { DocumentPreviewToolbar } from "@/components/documents/DocumentPreviewToolbar";
import { AppShell } from "@/components/layout/app-shell";
import { getJobBundle } from "@/lib/data";

type Props = {
  params: Promise<{ jobId: string }>;
};

export default async function CompletionPreviewPage({ params }: Props) {
  const { jobId } = await params;
  const bundle = await getJobBundle(jobId);
  if (!bundle) notFound();

  return (
    <AppShell title="Completion Certificate Preview" subtitle="Customer-facing completion certificate and workmanship guarantee preview." wide>
      <DocumentPreviewToolbar backHref={`/jobs/${jobId}`} />
      <CompletionCertificate bundle={bundle} />
    </AppShell>
  );
}
