import Link from "next/link";
import type { Route } from "next";
import { AppShell } from "@/components/layout/app-shell";
import { EmptyState } from "@/components/ui/EmptyState";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { getJobs } from "@/lib/data";
import { formatDate } from "@/lib/utils";

const SURVEY_STATUSES = new Set(["New Lead", "Survey Needed", "Survey Complete", "Ready For AI Quote"]);

export default async function SurveysPage() {
  const jobs = await getJobs();
  const surveyJobs = jobs.filter((job) => SURVEY_STATUSES.has(job.status));

  return (
    <AppShell
      title="Surveys"
      subtitle="Start video, import, manual, or takeoff surveys from one mobile-friendly queue."
      actions={
        <Link className="button-primary" href={"/jobs/new" as Route}>
          New Job
        </Link>
      }
    >
      {surveyJobs.length === 0 ? (
        <EmptyState actionHref="/jobs/new" actionLabel="Add Job" message="Jobs waiting for survey will appear here." title="No surveys waiting" />
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {surveyJobs.map((job) => (
            <article className="card interactive-card p-4" key={job.id}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="section-kicker text-[0.62rem]">{job.job_ref ?? "WR-J-TBC"}</span>
                    <StatusBadge status={job.status} />
                  </div>
                  <h2 className="mt-3 card-title text-white">{job.job_title}</h2>
                  <p className="mt-1 text-sm text-[var(--muted)]">{job.customer?.full_name ?? "Customer TBC"} | {job.property_address}</p>
                  <p className="mt-2 text-xs text-[var(--text-faint)]">Survey date: {formatDate(job.survey_date ?? null)}</p>
                </div>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-2">
                <Link className="button-primary !min-h-11 !px-3 !py-2 text-sm" href={`/jobs/${job.id}/survey/video` as Route}>
                  Video
                </Link>
                <Link className="button-secondary !min-h-11 !px-3 !py-2 text-sm" href={`/jobs/${job.id}/survey/video?mode=import` as Route}>
                  Import
                </Link>
                <Link className="button-ghost !min-h-11 !px-3 !py-2 text-sm" href={`/jobs/${job.id}/survey` as Route}>
                  Manual
                </Link>
                <Link className="button-ghost !min-h-11 !px-3 !py-2 text-sm" href={`/jobs/${job.id}/survey/takeoff` as Route}>
                  Takeoff
                </Link>
              </div>
            </article>
          ))}
        </div>
      )}
    </AppShell>
  );
}
