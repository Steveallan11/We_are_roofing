import Link from "next/link";
import { notFound } from "next/navigation";
import { PhotoUploadButton } from "@/components/forms/photo-upload";
import { QuoteActions } from "@/components/jobs/quote-actions";
import { AppShell } from "@/components/layout/app-shell";
import { SurveyForm } from "@/components/forms/survey-form";
import { StatusPill } from "@/components/ui/status-pill";
import { getJobBundle } from "@/lib/data";

type Props = {
  params: Promise<{ jobId: string }>;
};

export default async function SurveyPage({ params }: Props) {
  const { jobId } = await params;
  const bundle = await getJobBundle(jobId);
  if (!bundle) notFound();

  return (
    <AppShell
      title="Site Survey"
      subtitle="Capture the details needed for quoting and job overview: condition, measurements, access, likely cause, and what the customer is expecting."
      actions={
        <>
          <QuoteActions customerEmail={bundle.customer.email} jobId={bundle.job.id} quote={bundle.quote ?? null} />
          <Link className="button-ghost" href={`/jobs/${bundle.job.id}`}>
            Back to Job
          </Link>
        </>
      }
    >
      <div className="stack">
        <div className="card p-5">
          <p className="section-kicker text-[0.65rem] uppercase">Survey Route</p>
          <div className="mt-4 grid gap-4 md:grid-cols-3">
            <div className="rounded-2xl border border-[var(--border)] p-4">
              <p className="label">Roof Type</p>
              <p className="text-white">{bundle.job.roof_type ?? "Unknown"}</p>
            </div>
            <div className="rounded-2xl border border-[var(--border)] p-4">
              <p className="label">Job Type</p>
              <p className="text-white">{bundle.job.job_type ?? "Unknown"}</p>
            </div>
            <div className="rounded-2xl border border-[var(--border)] p-4">
              <p className="label">Customer</p>
              <p className="text-white">{bundle.customer.full_name}</p>
            </div>
          </div>
        </div>

        <div className="card p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="section-kicker text-[0.65rem] uppercase">Quote Readiness</p>
              <div className="mt-3 flex items-center gap-3">
                <StatusPill status={bundle.job.status} />
                {bundle.quote ? <StatusPill status={bundle.quote.status} /> : null}
              </div>
              <p className="mt-3 text-sm text-[var(--muted)]">
                Save the survey, upload the supporting photos, then generate the first draft from this screen. The draft will be saved back into the job file for review and sending.
              </p>
            </div>
            <div className="min-w-[280px] flex-1">
              <PhotoUploadButton jobId={bundle.job.id} />
            </div>
          </div>
        </div>

        <SurveyForm
          initialSurvey={bundle.survey}
          jobId={bundle.job.id}
          roofType={(bundle.job.roof_type as "Flat" | "Pitched" | "Slate" | "Tile" | "Fascia" | "Chimney" | "Mixed" | "Other") ?? "Other"}
          surveyType={(bundle.survey?.survey_type as "Flat Roof" | "Pitched / Tiled" | "Fascias / Soffits / Gutters" | "Chimney / Lead" | "Other / Misc") ?? "Other / Misc"}
        />
      </div>
    </AppShell>
  );
}
