import Link from "next/link";
import type { Route } from "next";
import { AppShell } from "@/components/layout/app-shell";
import { JobCard } from "@/components/jobs/job-card";
import { RateCardNudge } from "@/components/settings/RateCardNudge";
import { WeatherStrip } from "@/components/weather/WeatherStrip";
import { Button, Card, PageSection, Stat } from "@/components/ui/primitives";
import { getBusiness, getCustomers, getJobs, getPricingRules } from "@/lib/data";
import { PIPELINE_GROUPS } from "@/lib/jobs/pipelineGroups";
import { getAttentionReason, needsAttention } from "@/lib/jobs/nextAction";
import { getJobPipelineValue } from "@/lib/quotes/value";
import { currency, formatDate } from "@/lib/utils";

export default async function DashboardPage() {
  const [business, jobs, customers, pricingRules] = await Promise.all([
    getBusiness(),
    getJobs(),
    getCustomers(),
    getPricingRules()
  ]);
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
    .sort(
      (left, right) =>
        new Date(right.updated_at ?? right.created_at ?? 0).getTime() -
        new Date(left.updated_at ?? left.created_at ?? 0).getTime()
    )
    .slice(0, 5);
  const nextSurvey = jobs
    .filter((job) => job.survey_date)
    .sort((left, right) => new Date(left.survey_date ?? 0).getTime() - new Date(right.survey_date ?? 0).getTime())
    .find((job) => new Date(job.survey_date ?? 0).getTime() >= now.getTime());

  return (
    <AppShell
      title="Dashboard"
      subtitle={`${business.business_name} at a glance.`}
      actions={
        <>
          <Button variant="primary" size="md" asChild>
            <Link href="/jobs/new">New Job</Link>
          </Button>
          <Button variant="ghost" size="md" asChild>
            <Link href="/jobs">Open Jobs</Link>
          </Button>
        </>
      }
    >
      <div className="stack">
        {!hasRateCard ? <RateCardNudge /> : null}

        {/* Hero stats */}
        <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Stat label="Active Jobs" value={activeJobs.length} hint="Open work" tone="active" href="/jobs" />
          <Stat label="Pipeline Value" value={currency(pipelineValue)} hint="Across active jobs" />
          <Stat
            label="Revenue (Month)"
            value={currency(revenueThisMonth)}
            hint={`${new Date(monthStart).toLocaleDateString("en-GB", { month: "long" })} completed`}
            tone="ready"
          />
          <Stat label="Customers" value={customers.length} hint="Saved records" href="/customers" />
        </section>

        {/* Needs attention — only render if any */}
        {attentionJobs.length > 0 ? (
          <PageSection
            kicker="Needs Attention"
            title={`${attentionJobs.length} ${attentionJobs.length === 1 ? "job needs" : "jobs need"} action`}
            description="Overdue follow-ups, sent quotes going stale, surveys due today."
            actions={
              <Button variant="primary" size="md" asChild>
                <Link href="/jobs">View Jobs</Link>
              </Button>
            }
          >
            <div className="grid gap-2">
              {attentionJobs.slice(0, 3).map((job) => (
                <Link
                  className="rounded-lg border border-[var(--stage-alert-border)] bg-[var(--stage-alert-bg)] p-3 text-sm transition-colors hover:border-[var(--stage-alert)]"
                  href={`/jobs/${job.id}` as Route}
                  key={job.id}
                >
                  <span className="font-semibold text-[var(--text)]">
                    {job.job_ref ?? "WR-J-TBC"} · {job.customer?.full_name ?? job.job_title}
                  </span>
                  <span className="ml-2 text-[var(--stage-alert-text)]">{getAttentionReason(job)}</span>
                </Link>
              ))}
            </div>
          </PageSection>
        ) : null}

        {/* Today */}
        <div className="grid gap-3 lg:grid-cols-2">
          <PageSection
            kicker="Today"
            title={nextSurvey ? "Next survey" : "No survey booked"}
            actions={
              nextSurvey ? (
                <Button variant="secondary" size="sm" asChild>
                  <Link href={`/jobs/${nextSurvey.id}/survey` as Route}>Open</Link>
                </Button>
              ) : null
            }
          >
            {nextSurvey ? (
              <div>
                <p className="text-sm font-semibold text-[var(--text)]">
                  {nextSurvey.job_ref ?? "WR-J-TBC"} · {nextSurvey.customer?.full_name ?? nextSurvey.job_title}
                </p>
                <p className="mt-1 text-xs text-[var(--text-muted)]">{formatDate(nextSurvey.survey_date)}</p>
              </div>
            ) : (
              <p className="text-sm text-[var(--text-muted)]">
                No future survey date found. Use Jobs to book the next site visit.
              </p>
            )}
          </PageSection>

          <Card padding="md">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[0.62rem] font-bold uppercase tracking-[0.2em] text-[var(--dim)]">Weather</p>
                <p className="mt-1 text-xs text-[var(--text-muted)]">For booking surveys and planning site work.</p>
              </div>
            </div>
            <div className="mt-3">
              <WeatherStrip location={business.weather_location ?? "Yateley"} />
            </div>
          </Card>
        </div>

        {/* Pipeline */}
        <PageSection
          kicker="Pipeline"
          title="Where the work sits"
          actions={
            <Button variant="ghost" size="sm" asChild>
              <Link href="/jobs">Full board</Link>
            </Button>
          }
        >
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 xl:grid-cols-8">
            {PIPELINE_GROUPS.map((group) => {
              const groupJobs = jobs.filter((job) => group.statuses.includes(job.status));
              const value = groupJobs.reduce((sum, job) => sum + Number(getJobPipelineValue(job) ?? 0), 0);
              return (
                <Stat
                  key={group.key}
                  label={group.label}
                  value={groupJobs.length}
                  hint={value ? currency(value) : "—"}
                  href={`/jobs?filter=${group.key}`}
                  tone={group.stage}
                />
              );
            })}
          </div>
        </PageSection>

        {/* Recent jobs */}
        <PageSection
          kicker="Recent Jobs"
          title="Last updated"
          actions={
            <Button variant="ghost" size="sm" asChild>
              <Link href="/jobs">See all</Link>
            </Button>
          }
        >
          <div className="grid gap-3">
            {recentJobs.slice(0, 5).map((job) => (
              <JobCard compact job={job} key={job.id} list />
            ))}
          </div>
        </PageSection>

        {/* Quick Actions */}
        <PageSection kicker="Quick Actions" title="Common workflows" bare>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <QuickAction href="/jobs/new" label="New Job" />
            <QuickAction href="/jobs?filter=survey" label="Book Survey" />
            <QuickAction href="/jobs?filter=quoting" label="Create Quote" />
            <QuickAction href="/knowledge" label="Knowledge" />
          </div>
        </PageSection>
      </div>
    </AppShell>
  );
}

function QuickAction({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href as Route}
      className="flex min-h-[64px] items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 text-center text-sm font-semibold text-[var(--text)] transition-colors hover:border-[var(--gold)] hover:text-[var(--gold)]"
    >
      {label}
    </Link>
  );
}
