import { notFound } from "next/navigation";
import { DocumentPreviewToolbar } from "@/components/documents/DocumentPreviewToolbar";
import { SurveyReportDocument } from "@/components/documents/SurveyReportDocument";
import { AppShell } from "@/components/layout/app-shell";
import { getJobBundle } from "@/lib/data";

type Props = {
  params: Promise<{ jobId: string }>;
};

export default async function SurveyReportPreviewPage({ params }: Props) {
  const { jobId } = await params;
  const bundle = await getJobBundle(jobId);
  if (!bundle) notFound();

  return (
    <AppShell title="Survey Report Preview" subtitle="Customer-facing survey summary with condition findings and recommended works." wide>
      <DocumentPreviewToolbar backHref={`/jobs/${jobId}`} />
      <SurveyReportDocument bundle={bundle} />
    </AppShell>
  );
}
