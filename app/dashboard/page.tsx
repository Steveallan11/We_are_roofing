import Link from "next/link";
import type { Route } from "next";
import { AppShell } from "@/components/layout/app-shell";
import { MetricCard } from "@/components/layout/metric-card";
import { JobCard } from "@/components/jobs/job-card";
import { RateCardNudge } from "@/components/settings/RateCardNudge";
import { WeatherStrip } from "@/components/weather/WeatherStrip";
import { getBusiness, getCustomers, getJobs, getPricingRules } from "@/lib/data";
import { PIPELINE_GROUPS } from "@/lib/jobs/pipelineGroups";
import { getAttentionReason, needsAttention } from "@/lib/jobs/nextAction";
import { getJobPipelineValue } from "@/lib/quotes/value";
import { currency, formatDate } from "@/lib/utils";

export default async function DashboardPage() {
  const [business, jobs, customers, pricingRules] = await Promise.all([getBusiness(), getJobs(), getCustomers(), getPricingRules()]);
  const hasRateCard = pricingRules.some((rule) => rule.rule_name && rule.flat_adjustment != null);
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const activeJobs = jobs.filter((job) => !["Completed", "Not Proceeding", "Lost", "Archived"].includes(job.status));
  const attentionJobs = jobs.filter(needsAttention);
  const pipelineValue = activeJobs.reduce((sum, job) => sum + Number(getJobPipelineValue(job) ?? 0), 0);
  const revenueThisMonth = jobs
    .filter((job) => job.status === "Completed" && job.completed_at && new Date(job.completed_at) >= monthStart)
    .reduce((sum, job) => sum + Number(job.final_value ?? getJobPipelineValue(job) ?? 0), 0);
  const recentJobs = [...jobs]
    .sort((left, right) => new Date(right.updated_at ?? right.created_at ?? 0).getTime() - new Date(left.updated_at ?? left.created_at ?? 0).getTime())
    .slice(0, 5);
  const nextSurvey = jobs
    .filter((job) => job.survey_date)
    .sort((left, right) => new Date(left.survey_date ?? 0).getTime() - new Date(right.survey_date ?? 0).getTime())
    .find((job) => new Date(job.survey_date ?? 0).getTime() >= now.getTime());

  return (
    <AppShell
      title="Dashboard"
      subtitle={`${business.business_name} at a glance. Keep surveys, quotes, customers, and next actions moving from one clear workspace.`}
      actions={
        <>
          <Link className="button-primary" href="/jobs/new">
            New Job
          </Link>
          <Link className="button-ghost" href={"/jobs" as Route}>
            Open Jobs
          </Link>
        </>
      }
    >
      {!hasRateCard ? <RateCardNudge /> : null}

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
        <MetricCard hint="Open work excluding completed, lost, and archived" label="Active Jobs" value={activeJobs.length} />
        <MetricCard hint="Estimated value across active jobs" label="Pipeline Value" value={currency(pipelineValue)} />
        <MetricCard hint="Completed jobs this month" label="Revenue This Month" value={currency(revenueThisMonth)} />
        <MetricCard hint="Saved customer records" label="Customers" value={customers.length} />
      </section>

      <section className="mt-4 grid gap-3 md:grid-cols-2 xl:hidden">
        <QuickAction href="/jobs/new" label="Add New Job" text="Create the customer record and job file." />
        <QuickAction href="/jobs?filter=survey" label="Book Survey" text="Open jobs waiting for a site visit." />
        <QuickAction href="/jobs?filter=quoting" label="Create Quote" text="Pick up survey-complete jobs ready to price." />
        <QuickAction href="/knowledge" label="Knowledge Base" text="Manage examples, style references, and uploads." />
      </section>

      <section className="mt-4 card p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="section-kicker text-[0.65rem] uppercase">Weather</p>
            <p className="mt-1 text-sm text-[var(--muted)]">Roofing forecast for booking surveys and planning site work.</p>
          </div>
          <WeatherStrip location={business.weather_location ?? "Yateley"} />
        </div>
      </section>

      <section className="mt-6 grid gap-4 xl:grid-cols-[1.35fr_0.65fr]">
        <div className="stack">
          <div className={`card p-5 ${attentionJobs.length ? "border-l-4 border-l-[color:var(--emergency)] bg-[color:var(--emergency-bg)]" : ""}`}>
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="section-kicker text-[0.65rem] uppercase">Needs Attention</p>
                <h2 className="mt-2 font-condensed text-3xl text-white">{attentionJobs.length ? `${attentionJobs.length} jobs need action` : "Everything looks up to date"}</h2>
                <p className="mt-2 text-sm text-[var(--muted)]">
                  {attentionJobs.length
                    ? attentionJobs
                        .slice(0, 3)
                        .map((job) => `${job.job_ref ?? "WR-J-TBC"} ${job.customer?.full_name ?? job.job_title}`)
                        .join(" | ")
                    : "No overdue follow-ups, stale sent quotes, or surveys due today."}
                </p>
              </div>
              <Link className={attentionJobs.length ? "button-primary" : "button-ghost"} href={"/jobs" as Route}>
                View Jobs
              </Link>
            </div>
            {attentionJobs.length ? (
              <div className="mt-4 grid gap-2">
                {attentionJobs.slice(0, 3).map((job) => (
                  <Link className="rounded-2xl border border-[var(--border)] bg-black/20 p-3 text-sm transition hover:border-[var(--gold)]/60" href={`/jobs/${job.id}` as Route} key={job.id}>
                    <span className="font-semibold text-white">{job.job_ref ?? "WR-J-TBC"} | {job.customer?.full_name ?? job.job_title}</span>
                    <span className="ml-2 text-[var(--muted)]">{getAttentionReason(job)}</span>
                  </Link>
                ))}
              </div>
            ) : null}
          </div>

          <div className="card p-5 xl:hidden">
            <p className="section-kicker text-[0.65rem] uppercase">Work This Week</p>
            <h2 className="mt-2 font-condensed text-3xl text-white">{nextSurvey ? "Next booked survey" : "No survey booked"}</h2>
            {nextSurvey ? (
              <div className="mt-4 rounded-2xl border border-[var(--border)] bg-black/20 p-4">
                <p className="font-semibold text-white">{nextSurvey.job_ref ?? "WR-J-TBC"} | {nextSurvey.customer?.full_name ?? nextSurvey.job_title}</p>
                <p className="mt-2 text-sm text-[var(--muted)]">{formatDate(nextSurvey.survey_date)}</p>
                <Link className="button-secondary button-sm w-full mt-4" href={`/jobs/${nextSurvey.id}/survey` as Route}>
                  Open survey
                </Link>
              </div>
            ) : (
              <p className="mt-3 text-sm text-[var(--muted)]">No future survey date found. Use Jobs to book the next site visit.</p>
            )}
          </div>

          <div className="card hidden p-5 lg:block">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="section-kicker text-[0.65rem] uppercase">Pipeline</p>
                <h2 className="mt-2 font-condensed text-3xl text-white">Where the work sits</h2>
              </div>
              <Link className="button-ghost button-sm" href={"/jobs" as Route}>
                Full board
              </Link>
            </div>
            <div className="mt-5 grid gap-3 md:grid-cols-4 xl:grid-cols-8">
              {PIPELINE_GROUPS.map((group) => {
                const groupJobs = jobs.filter((job) => group.statuses.includes(job.status));
                const value = groupJobs.reduce((sum, job) => sum + Number(getJobPipelineValue(job) ?? 0), 0);
                return (
                  <Link className="rounded-2xl border border-[var(--border)] bg-black/20 p-4 transition hover:border-[var(--gold)]/60" href={`/jobs?filter=${group.key}` as Route} key={group.key}>
                    <p className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--dim)]">{group.label}</p>
                    <p className="mt-3 font-display text-4xl text-[var(--gold-l)]">{groupJobs.length}</p>
                    <p className="mt-1 text-xs text-[var(--muted)]">{value ? currency(value) : "No value yet"}</p>
                  </Link>
                );
              })}
            </div>
          </div>

          <div className="card p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="section-kicker text-[0.65rem] uppercase">Recent Jobs</p>
                <h2 className="mt-2 font-condensed text-3xl text-white">Last updated</h2>
              </div>
              <Link className="button-ghost button-sm" href={"/jobs" as Route}>
                See all
              </Link>
            </div>
            <div className="mt-4 grid gap-3">
              {recentJobs.slice(0, 3).map((job) => (
                <JobCard compact job={job} key={job.id} list />
              ))}
            </div>
          </div>
        </div>

        <aside className="stack hidden xl:flex xl:flex-col">
          <div className="card p-5">
            <p className="section-kicker text-[0.65rem] uppercase">Quick Actions</p>
            <div className="mt-4 grid gap-3">
              <QuickAction href="/jobs/new" label="Add New Job" text="Create the customer record and job file." />
              <QuickAction href="/jobs?filter=survey" label="Book Survey" text="Find jobs waiting for a site survey." />
              <QuickAction href="/jobs?filter=quoting" label="Create Quote" text="Open survey-complete jobs ready to price." />
              <QuickAction href="/knowledge" label="Knowledge Base" text="Upload quote examples and style references." />
            </div>
          </div>

          <div className="card p-5">
            <p className="section-kicker text-[0.65rem] uppercase">This Week</p>
            <h2 className="mt-2 font-condensed text-3xl text-white">{nextSurvey ? "Next booked survey" : "No survey booked"}</h2>
            {nextSurvey ? (
              <div className="mt-4 rounded-2xl border border-[var(--border)] bg-black/20 p-4">
                <p className="font-semibold text-white">{nextSurvey.job_ref ?? "WR-J-TBC"} | {nextSurvey.customer?.full_name ?? nextSurvey.job_title}</p>
                <p className="mt-2 text-sm text-[var(--muted)]">{formatDate(nextSurvey.survey_date)}</p>
                <Link className="button-secondary button-sm w-full mt-4" href={`/jobs/${nextSurvey.id}/survey` as Route}>
                  Open survey
                </Link>
              </div>
            ) : (
              <p className="mt-3 text-sm text-[var(--muted)]">No future survey date found. Use Jobs to book the next site visit.</p>
            )}
          </div>
        </aside>
      </section>
    </AppShell>
  );
}

function QuickAction({ href, label, text }: { href: string; label: string; text: string }) {
  return (
    <Link className="rounded-2xl border border-[var(--gold)]/25 bg-[linear-gradient(135deg,rgba(212,175,55,0.16),rgba(8,8,8,0.88))] p-4 transition hover:border-[var(--gold)]/70 hover:bg-[linear-gradient(135deg,rgba(212,175,55,0.2),rgba(8,8,8,0.92))]" href={href as Route}>
      <div className="flex items-center justify-between gap-3">
        <p className="font-semibold text-white">{label}</p>
        <span className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--gold-l)]">Open</span>
      </div>
      <p className="mt-2 text-sm leading-6 text-[var(--text)]">{text}</p>
    </Link>
  );
}
