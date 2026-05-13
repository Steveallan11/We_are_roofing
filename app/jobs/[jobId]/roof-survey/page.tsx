import Link from "next/link";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { RoofSurveyTool } from "@/components/survey/RoofSurveyTool";
import { SurveyProvider } from "@/components/survey/SurveyProvider";
import { getJobBundle } from "@/lib/data";
import { getOrCreateRoofSurvey } from "@/lib/roof-surveys";

type Props = {
  params: Promise<{ jobId: string }>;
};

export default async function RoofSurveyPage({ params }: Props) {
  const { jobId } = await params;
  const bundle = await getJobBundle(jobId);
  if (!bundle) notFound();

  const survey = await getOrCreateRoofSurvey(bundle.job.id, `${bundle.job.job_ref ?? "WR-J-TBC"} Roof Takeoff`);
  if (!survey.id) notFound();

  return (
    <AppShell
      title="Roof Survey Tool"
      subtitle="Trace the roof from a satellite screenshot, calibrate the scale, generate the live bill of quantities, and push the measured takeoff straight into the saved quote workflow."
      actions={
        <>
          <Link className="button-secondary" href={`/jobs/${bundle.job.id}/survey`}>
            Standard Survey
          </Link>
          <Link className="button-ghost" href={`/jobs/${bundle.job.id}`}>
            Back to Job
          </Link>
        </>
      }
    >
      <div className="card p-5">
        <div className="grid gap-4 md:grid-cols-4">
          <div className="rounded-2xl border border-[var(--border)] p-4">
            <p className="label">Job Number</p>
            <p className="text-white">{bundle.job.job_ref ?? "WR-J-TBC"}</p>
          </div>
          <div className="rounded-2xl border border-[var(--border)] p-4">
            <p className="label">Customer</p>
            <p className="text-white">{bundle.customer.full_name}</p>
          </div>
          <div className="rounded-2xl border border-[var(--border)] p-4">
            <p className="label">Property</p>
            <p className="text-white">{bundle.job.property_address}</p>
          </div>
          <div className="rounded-2xl border border-[var(--border)] p-4">
            <p className="label">Quote Link</p>
            <p className="text-white">{bundle.quote ? bundle.quote.quote_ref : "Will create or update the draft quote"}</p>
          </div>
        </div>
      </div>

      <div className="mt-5">
        <SurveyProvider jobId={bundle.job.id} surveyId={survey.id}>
          <RoofSurveyTool initialSurvey={survey} jobId={bundle.job.id} surveyId={survey.id} />
        </SurveyProvider>
      </div>
    </AppShell>
  );
}
