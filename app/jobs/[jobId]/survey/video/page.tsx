import Link from "next/link";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { VideoSurveyWorkspace } from "@/components/survey/VideoSurveyWorkspace";
import { getJobBundle } from "@/lib/data";

type Props = {
  params: Promise<{ jobId: string }>;
  searchParams?: Promise<{ mode?: string }>;
};

export default async function VideoSurveyPage({ params, searchParams }: Props) {
  const { jobId } = await params;
  const bundle = await getJobBundle(jobId);
  if (!bundle) notFound();

  const query = searchParams ? await searchParams : undefined;
  const initialMode = query?.mode === "import" ? "import" : "record";

  return (
    <AppShell
      title="Video Survey"
      subtitle="Capture the roof on video, let the AI build the first survey draft, then review the important fields before it lands in the job file."
      actions={
        <>
          <Link className="button-secondary" href={`/jobs/${bundle.job.id}/survey`}>
            Manual Survey
          </Link>
          <Link className="button-ghost" href={`/jobs/${bundle.job.id}`}>
            Back to Job
          </Link>
        </>
      }
      wide
    >
      <VideoSurveyWorkspace
        customerName={bundle.customer.full_name}
        initialMode={initialMode}
        jobId={bundle.job.id}
        jobTitle={bundle.job.job_title}
        propertyAddress={bundle.job.property_address}
      />
    </AppShell>
  );
}
