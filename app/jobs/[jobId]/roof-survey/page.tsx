import Link from "next/link";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { GoogleMapsTakeoff } from "@/components/survey/GoogleMapsTakeoff";
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
      subtitle="Draw directly on Google Maps satellite view, import KML/KMZ, and save real-world measurements without manual calibration."
      wide
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
      <div className="card p-3 md:p-4">
        <div className="grid gap-2 md:grid-cols-4">
          <div className="rounded-xl border border-[var(--border)] px-3 py-2">
            <p className="label">Job Number</p>
            <p className="text-sm text-white">{bundle.job.job_ref ?? "WR-J-TBC"}</p>
          </div>
          <div className="rounded-xl border border-[var(--border)] px-3 py-2">
            <p className="label">Customer</p>
            <p className="truncate text-sm text-white">{bundle.customer.full_name}</p>
          </div>
          <div className="rounded-xl border border-[var(--border)] px-3 py-2">
            <p className="label">Property</p>
            <p className="truncate text-sm text-white">{bundle.job.property_address}</p>
          </div>
          <div className="rounded-xl border border-[var(--border)] px-3 py-2">
            <p className="label">Quote Link</p>
            <p className="truncate text-sm text-white">{bundle.quote ? bundle.quote.quote_ref : "Will create or update the draft quote"}</p>
          </div>
        </div>
      </div>

      <div className="mt-3">
        <div className="mb-3 rounded-xl border border-[rgba(212,175,55,0.35)] bg-[rgba(212,175,55,0.08)] px-4 py-3">
          <p className="section-kicker text-[var(--gold)]">Google Maps Takeoff</p>
          <p className="mt-1 text-xs leading-5 text-[var(--muted)]">
            This version uses live satellite imagery and Google geometry measurements. No scale calibration or uploaded map screenshot is needed.
          </p>
        </div>
        <GoogleMapsTakeoff
          address={bundle.job.property_address}
          customerEmail={bundle.customer.email}
          customerName={bundle.customer.full_name}
          initialSurvey={survey}
          jobId={bundle.job.id}
          jobRef={bundle.job.job_ref}
          surveyId={survey.id}
        />
      </div>
    </AppShell>
  );
}
