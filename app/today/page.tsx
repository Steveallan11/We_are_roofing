import Link from "next/link";
import type { Route } from "next";
import { AppShell } from "@/components/layout/app-shell";
import { JobCard } from "@/components/jobs/job-card";
import { RateCardNudge } from "@/components/settings/RateCardNudge";
import { WeatherStrip } from "@/components/weather/WeatherStrip";
import { Button, Card, PageSection } from "@/components/ui/primitives";
import { getBusiness, getJobs, getPricingRules } from "@/lib/data";
import { getAttentionReason, needsAttention } from "@/lib/jobs/nextAction";
import { formatDate } from "@/lib/utils";

export default async function TodayPage() {
  const [business, jobs, pricingRules] = await Promise.all([getBusiness(), getJobs(), getPricingRules()]);
  const hasRateCard = pricingRules.some((rule) => rule.rule_name && rule.flat_adjustment != null);
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const todayEnd = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000);

  const attentionJobs = jobs.filter(needsAttention);
  const surveysToday = jobs
    .filter((job) => job.survey_date)
    .filter((job) => {
      const date = new Date(job.survey_date as string);
      return date >= todayStart && date < todayEnd;
    })
    .sort((left, right) => new Date(left.survey_date ?? 0).getTime() - new Date(right.survey_date ?? 0).getTime());
  const nextSurvey = jobs
    .filter((job) => job.survey_date && new Date(job.survey_date).getTime() >= todayEnd.getTime())
    .sort((left, right) => new Date(left.survey_date ?? 0).getTime() - new Date(right.survey_date ?? 0).getTime())[0];
  const recentJobs = [...jobs]
    .filter((job) => !["Completed", "Not Proceeding", "Lost", "Archived"].includes(job.status))
    .sort(
      (left, right) =>
        new Date(right.updated_at ?? right.created_at ?? 0).getTime() -
        new Date(left.updated_at ?? left.created_at ?? 0).getTime()
    )
    .slice(0, 3);

  const greeting = getGreeting(now);
  const ownerName = business.business_name?.trim() || "there";

  return (
    <AppShell
      title="Today"
      subtitle={`${greeting}, ${ownerName}.`}
      actions={
        <>
          <Button variant="primary" size="md" asChild>
            <Link href="/jobs/new">New Job</Link>
          </Button>
          <Button variant="ghost" size="md" asChild>
            <Link href="/jobs">All Jobs</Link>
          </Button>
        </>
      }
    >
      <div className="stack">
        {!hasRateCard ? <RateCardNudge /> : null}

        {attentionJobs.length > 0 ? (
          <PageSection
            kicker="Needs Attention"
            title={`${attentionJobs.length} ${attentionJobs.length === 1 ? "job needs" : "jobs need"} action`}
            description="Overdue follow-ups, sent quotes going stale, surveys due today."
            actions={
              attentionJobs.length > 3 ? (
                <Button variant="ghost" size="sm" asChild>
                  <Link href="/jobs?filter=attention">See all</Link>
                </Button>
              ) : null
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

        <div className="grid gap-3 lg:grid-cols-2">
          <PageSection
            kicker={surveysToday.length > 0 ? "Today" : "Coming Up"}
            title={
              surveysToday.length > 0
                ? `${surveysToday.length} ${surveysToday.length === 1 ? "survey" : "surveys"} today`
                : nextSurvey
                  ? "Next survey"
                  : "No surveys booked"
            }
            actions={
              <Button variant="ghost" size="sm" asChild>
                <Link href="/calendar">Calendar</Link>
              </Button>
            }
          >
            {surveysToday.length > 0 ? (
              <div className="grid gap-2">
                {surveysToday.map((survey) => (
                  <Link
                    className="flex items-center justify-between rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3 text-sm transition-colors hover:border-[var(--gold)]"
                    href={`/jobs/${survey.id}/survey` as Route}
                    key={survey.id}
                  >
                    <span className="text-[var(--text)]">
                      <span className="font-semibold">{survey.customer?.full_name ?? survey.job_title}</span>
                      <span className="ml-2 text-xs text-[var(--text-muted)]">{formatTime(survey.survey_date as string)}</span>
                    </span>
                    <span className="text-xs text-[var(--gold)]">Open</span>
                  </Link>
                ))}
              </div>
            ) : nextSurvey ? (
              <div>
                <p className="text-sm font-semibold text-[var(--text)]">
                  {nextSurvey.customer?.full_name ?? nextSurvey.job_title}
                </p>
                <p className="mt-1 text-xs text-[var(--text-muted)]">{formatDate(nextSurvey.survey_date)}</p>
                <Button variant="ghost" size="sm" asChild className="mt-3">
                  <Link href={`/jobs/${nextSurvey.id}` as Route}>Open job</Link>
                </Button>
              </div>
            ) : (
              <p className="text-sm text-[var(--text-muted)]">
                No survey booked. Use Jobs to book the next site visit.
              </p>
            )}
          </PageSection>

          <Card padding="md">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[0.62rem] font-bold uppercase tracking-[0.2em] text-[var(--dim)]">Weather</p>
                <p className="mt-1 text-xs text-[var(--text-muted)]">Plan surveys and site work.</p>
              </div>
            </div>
            <div className="mt-3">
              <WeatherStrip location={business.weather_location ?? "Yateley"} />
            </div>
          </Card>
        </div>

        {recentJobs.length > 0 ? (
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
              {recentJobs.map((job) => (
                <JobCard compact job={job} key={job.id} list />
              ))}
            </div>
          </PageSection>
        ) : null}
      </div>
    </AppShell>
  );
}

function getGreeting(date: Date): string {
  const hour = date.getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  } catch {
    return "";
  }
}
