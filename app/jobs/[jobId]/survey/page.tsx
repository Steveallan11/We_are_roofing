import Link from "next/link";
import type { Route } from "next";
import { notFound } from "next/navigation";
import { PhotoUploadButton } from "@/components/forms/photo-upload";
import { QuoteActions } from "@/components/jobs/quote-actions";
import { AppShell } from "@/components/layout/app-shell";
import { SurveyForm } from "@/components/forms/survey-form";
import { SurveyTypePicker } from "@/components/survey/SurveyTypePicker";
import { getJobBundle } from "@/lib/data";

type Props = {
  params: Promise<{ jobId: string }>;
};

export default async function SurveyPage({ params }: Props) {
  const { jobId } = await params;
  const bundle = await getJobBundle(jobId);
  if (!bundle) notFound();
  const roofSurveyHref = `/jobs/${bundle.job.id}/roof-survey` as Route;

  return (
    <AppShell
      title="Site Survey"
      subtitle="Capture the details needed for quoting and job overview: condition, measurements, access, likely cause, and what the customer is expecting."
      actions={
        <>
          <QuoteActions customerEmail={bundle.customer.email} customerName={bundle.customer.full_name} jobId={bundle.job.id} jobTitle={bundle.job.job_title} quote={bundle.quote ?? null} />
          <Link className="button-ghost" href={`/jobs/${bundle.job.id}`}>
            Back to Job
          </Link>
        </>
      }
    >
      <div className="stack">
        <div className="card p-5">
          <p className="section-kicker text-[0.65rem] uppercase">Survey Route</p>
          <div className="mt-4">
            <SurveyTypePicker jobId={bundle.job.id} />
          </div>
          <div className="mt-4 grid gap-4 md:grid-cols-3">
            <div className="rounded-2xl border border-[var(--border)] p-4">
              <p className="label">Job Number</p>
              <p className="text-white">{bundle.job.job_ref ?? "WR-J-TBC"}</p>
            </div>
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

        <div className="card overflow-hidden">
          <div className="flex border-b border-[var(--border)]">
            <div className="border-b-2 border-[var(--gold)] px-5 py-3 text-sm font-bold text-[var(--gold)]">Survey Form</div>
            <Link className="border-b-2 border-transparent px-5 py-3 text-sm font-semibold text-[var(--text-faint)] transition hover:text-[var(--gold)]" href={roofSurveyHref}>
              Roof Map
            </Link>
          </div>
          <div className="border-b border-[var(--border)] bg-black/10 p-5">
            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(320px,560px)] lg:items-start">
              <div>
                <p className="section-kicker text-[0.65rem] uppercase">Supporting Photos</p>
                <p className="mt-2 text-sm text-[var(--muted)]">
                  Add site photos while you fill out the survey. They stay on the job file and give the quote/review process better context.
                </p>
              </div>
              <PhotoUploadButton jobId={bundle.job.id} />
            </div>
          </div>
          <SurveyForm
            initialSurvey={bundle.survey}
            jobId={bundle.job.id}
            roofType={(bundle.job.roof_type as "Flat" | "Pitched" | "Slate" | "Tile" | "Fascia" | "Chimney" | "Mixed" | "Other") ?? "Other"}
            surveyType={(bundle.survey?.survey_type as "Flat Roof" | "Pitched / Tiled" | "Fascias / Soffits / Gutters" | "Chimney / Lead" | "Other / Misc") ?? "Other / Misc"}
          />
        </div>
      </div>
    </AppShell>
  );
}
