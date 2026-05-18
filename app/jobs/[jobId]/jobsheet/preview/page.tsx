import { notFound } from "next/navigation";
import { DocumentPreviewToolbar } from "@/components/documents/DocumentPreviewToolbar";
import { JobSheetDocument } from "@/components/documents/JobSheetDocument";
import { AppShell } from "@/components/layout/app-shell";
import { getJobBundle } from "@/lib/data";

type Props = {
  params: Promise<{ jobId: string }>;
};

export default async function JobSheetPreviewPage({ params }: Props) {
  const { jobId } = await params;
  const bundle = await getJobBundle(jobId);
  if (!bundle) notFound();

  return (
    <AppShell title="Job Sheet Preview" subtitle="Site working document for crew, access, materials, and safety notes." wide>
      <DocumentPreviewToolbar backHref={`/jobs/${jobId}`} />
      <JobSheetDocument bundle={bundle} />
    </AppShell>
  );
}
