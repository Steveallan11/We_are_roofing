import Link from "next/link";
import type { Route } from "next";
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
  const roofSurveyHref = `/jobs/${bundle.job.id}/roof-survey` as Route;
  const videoSurveyHref = `/jobs/${bundle.job.id}/survey/video` as Route;
  const importVideoHref = `/jobs/${bundle.job.id}/survey/video?mode=import` as Route;
  const takeoffHref = `/jobs/${bundle.job.id}/survey/takeoff` as Route;

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
          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {[
              { href: videoSurveyHref, icon: "VID", label: "Video Survey", sub: "Film roof and review AI draft", tag: "Recommended" },
              { href: importVideoHref, icon: "IMP", label: "Import Video", sub: "Use gallery or glasses footage", tag: "" },
              { href: `/jobs/${bundle.job.id}/survey` as Route, icon: "MAN", label: "Manual Survey", sub: "Fill in the full form by hand", tag: "" },
              { href: takeoffHref, icon: "MAP", label: "Roof Takeoff", sub: "Measure from the roof survey tool", tag: "" }
            ].map((item) => (
              <Link className="rounded-[8px] border border-[var(--border)] bg-[var(--card)] p-4 transition hover:border-[var(--gold)]/60" href={item.href} key={item.label}>
                <div className="flex items-start justify-between gap-3">
                  <p className="section-kicker text-[0.58rem] uppercase">{item.icon}</p>
                  {item.tag ? <span className="rounded-full bg-[rgba(212,175,55,0.14)] px-2 py-1 text-[0.62rem] font-semibold uppercase text-[var(--gold-l)]">{item.tag}</span> : null}
                </div>
                <p className="mt-3 text-sm font-semibold text-white">{item.label}</p>
                <p className="mt-1 text-xs text-[var(--muted)]">{item.sub}</p>
              </Link>
            ))}
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
          <div className="mt-4 flex flex-wrap gap-3">
            <Link className="button-secondary" href={videoSurveyHref}>
              Open Video Survey
            </Link>
            <Link className="button-ghost" href={roofSurveyHref}>
              Open Roof Survey Tool
            </Link>
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
