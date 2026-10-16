import { notFound } from "next/navigation";
import { CompletionCertificate } from "@/components/documents/CompletionCertificate";
import { CompletionDetailsEditor } from "@/components/documents/CompletionDetailsEditor";
import Link from "next/link";
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
      <CompletionDetailsEditor
        jobId={jobId}
        initialScope={bundle.quote?.scope_of_works || bundle.survey?.recommended_works || bundle.job.job_title}
        variations={bundle.variations}
        savedDetails={bundle.completion_details}
        handoverDocuments={bundle.documents.filter((document) => ["job_completion_pdf", "workmanship_warranty_pdf"].includes(document.document_type))}
      />
      <div className="flex flex-wrap gap-2">
        <Link className="button-secondary" href={`/comms?job=${jobId}&compose=1&completion=1`}>Prepare completion email</Link>
      </div>
      <CompletionCertificate bundle={bundle} />
    </AppShell>
  );
}
