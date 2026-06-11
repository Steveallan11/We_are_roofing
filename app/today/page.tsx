import Link from "next/link";
import type { Route } from "next";
import { AppShell } from "@/components/layout/app-shell";
import { JobCard } from "@/components/jobs/job-card";
import { RateCardNudge } from "@/components/settings/RateCardNudge";
import { WeatherStrip } from "@/components/weather/WeatherStrip";
import { TodayJobsGrid } from "@/components/today/TodayJobsGrid";
import { Button, Card, PageSection } from "@/components/ui/primitives";
import { getBusiness, getJobs, getPricingRules, getUnreadCustomerReplies, getUpcomingDiaryTasks } from "@/lib/data";
import { getAttentionReason, needsAttention } from "@/lib/jobs/nextAction";
import { formatDate } from "@/lib/utils";

export default async function TodayPage() {
  const [business, jobs, pricingRules, unreadReplies, upcomingTasks] = await Promise.all([
    getBusiness(),
    getJobs(),
    getPricingRules(),
    getUnreadCustomerReplies(),
    getUpcomingDiaryTasks()
  ]);
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
  const diaryRoute = "/diary" as Route;

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

        {upcomingTasks.length > 0 ? (
          <PageSection
            kicker="Tasks due"
            title={`${upcomingTasks.length} ${upcomingTasks.length === 1 ? "task" : "tasks"} overdue or today`}
            description="Complete or reschedule."
            actions={
              <Button variant="ghost" size="sm" asChild>
                <Link href={diaryRoute}>View Diary</Link>
              </Button>
            }
          >
            <div className="grid gap-2">
              {upcomingTasks.slice(0, 3).map((task) => (
                <Link
                  className="rounded-lg border border-[#f59e0b]/40 bg-[#f59e0b]/10 p-3 text-sm transition-colors hover:border-[#f59e0b]"
                  href={task.linked_job_id ? (`/jobs/${task.linked_job_id}` as Route) : diaryRoute}
                  key={task.id}
                >
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="font-semibold text-[var(--text)]">{task.title || "Untitled task"}</span>
                    <span className="shrink-0 text-[10px] uppercase tracking-wider text-[var(--text-muted)]">{task.entry_type}</span>
                  </div>
                  {task.body ? <p className="mt-1 truncate text-xs text-[var(--text-muted)]">{task.body}</p> : null}
                </Link>
              ))}
            </div>
          </PageSection>
        ) : null}

        {unreadReplies.length > 0 ? (
          <PageSection
            kicker="Customer replies"
            title={`${unreadReplies.length} unread ${unreadReplies.length === 1 ? "message" : "messages"}`}
            description="Customers are waiting for a response."
            actions={
              <Button variant="primary" size="sm" asChild>
                <Link href="/comms">Open Comms</Link>
              </Button>
            }
          >
            <div className="grid gap-2">
              {unreadReplies.slice(0, 3).map((reply) => (
                <Link
                  className="rounded-lg border border-[#3b82f6]/40 bg-[#3b82f6]/10 p-3 text-sm transition-colors hover:border-[#3b82f6]"
                  href={(reply.job_id ? `/jobs/${reply.job_id}` : "/comms") as Route}
                  key={reply.conversation_id}
                >
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="font-semibold text-[var(--text)]">
                      {reply.customer_name ?? reply.subject ?? "Customer"}
                      {reply.job_ref ? <span className="ml-2 text-xs text-[var(--text-muted)]">{reply.job_ref}</span> : null}
                    </span>
                    <span className="shrink-0 text-[10px] uppercase tracking-wider text-[var(--text-muted)]">{reply.channel}</span>
                  </div>
                  {reply.preview ? <p className="mt-1 truncate text-xs text-[var(--text-muted)]">{reply.preview}</p> : null}
                </Link>
              ))}
            </div>
          </PageSection>
        ) : null}

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
                ? `${surveysToday.length} ${surveysToday.length === 1 ? "site visit" : "site visits"} today`
                : nextSurvey
                  ? "Next visit"
                  : "No visits booked"
            }
            actions={
              <Button variant="ghost" size="sm" asChild>
                <Link href="/calendar">Calendar</Link>
              </Button>
            }
          >
            {surveysToday.length > 0 ? (
              <TodayJobsGrid jobs={surveysToday} />
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
                No visit booked. Use the calendar to schedule site surveys.
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
