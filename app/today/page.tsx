import Link from "next/link";
import type { Route } from "next";
import { AppShell } from "@/components/layout/app-shell";
import { JobCard } from "@/components/jobs/job-card";
import { RateCardNudge } from "@/components/settings/RateCardNudge";
import { TodayJobsGrid } from "@/components/today/TodayJobsGrid";
import { Button, Card, PageSection } from "@/components/ui/primitives";
import { WeatherStrip } from "@/components/weather/WeatherStrip";
import { getBusiness, getJobs, getPricingRules, getUnreadCustomerReplies, getUpcomingDiaryTasks } from "@/lib/data";
import { getAttentionReason, needsAttention } from "@/lib/jobs/nextAction";
import { formatDate } from "@/lib/utils";

type PriorityItem = {
  id: string;
  title: string;
  detail: string;
  href: Route;
  kind: "task" | "message" | "job";
};

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
  const openJobs = jobs.filter((job) => !["Completed", "Not Proceeding", "Lost", "Archived"].includes(job.status));
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
  const recentJobs = [...openJobs]
    .sort(
      (left, right) =>
        new Date(right.updated_at ?? right.created_at ?? 0).getTime() -
        new Date(left.updated_at ?? left.created_at ?? 0).getTime()
    )
    .slice(0, 3);

  const priorities: PriorityItem[] = [
    ...upcomingTasks.map((task) => ({
      id: `task-${task.id}`,
      title: task.title || "Task needs completing",
      detail: task.body || "Due today or overdue",
      href: (task.linked_job_id ? `/jobs/${task.linked_job_id}` : "/diary") as Route,
      kind: "task" as const
    })),
    ...unreadReplies.map((reply) => ({
      id: `message-${reply.conversation_id}`,
      title: reply.customer_name ?? reply.subject ?? "Customer message",
      detail: reply.preview || "A customer is waiting for a reply",
      href: (reply.job_id ? `/jobs/${reply.job_id}` : "/comms") as Route,
      kind: "message" as const
    })),
    ...attentionJobs.map((job) => ({
      id: `job-${job.id}`,
      title: `${job.job_ref ?? "Job"} · ${job.customer?.full_name ?? job.job_title}`,
      detail: getAttentionReason(job),
      href: `/jobs/${job.id}` as Route,
      kind: "job" as const
    }))
  ];

  const dateLabel = new Intl.DateTimeFormat("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long"
  }).format(now);
  const priorityCount = priorities.length;

  return (
    <AppShell
      title="Today"
      subtitle={dateLabel}
      actions={
        <Button asChild size="md" variant="primary">
          <Link href="/jobs/new">+ New job</Link>
        </Button>
      }
    >
      <div className="stack">
        <section className="today-welcome">
          <div className="min-w-0">
            <p className="today-welcome__eyebrow">{business.business_name || "We Are Roofing"}</p>
            <h2>{getGreeting(now)}</h2>
            <p>
              {priorityCount > 0
                ? `${priorityCount} ${priorityCount === 1 ? "thing needs" : "things need"} your attention.`
                : "Everything is up to date. You are ready for the day."}
            </p>
          </div>
          <div className="today-quick-actions" aria-label="Quick actions">
            <QuickAction href="/jobs/new" label="Add a new job" icon="+" />
            <QuickAction href="/customers" label="Find a customer" icon="⌕" />
            <QuickAction href="/comms" label="Open messages" icon="✉" />
            <QuickAction href="/calendar" label="View calendar" icon="□" />
          </div>
        </section>

        <div className="today-summary" aria-label="Today's summary">
          <SummaryCard href="/jobs?filter=attention" label="Needs action" value={priorityCount} urgent={priorityCount > 0} />
          <SummaryCard href="/calendar" label="Visits today" value={surveysToday.length} />
          <SummaryCard href="/comms" label="Unread messages" value={unreadReplies.length} urgent={unreadReplies.length > 0} />
          <SummaryCard href="/jobs" label="Open jobs" value={openJobs.length} />
        </div>

        {!hasRateCard ? <RateCardNudge /> : null}

        <PageSection
          kicker="Your next actions"
          title={priorityCount > 0 ? "Start here" : "You are all caught up"}
          description={priorityCount > 0 ? "Work through this list from the top." : "New customer replies and overdue work will appear here."}
          actions={
            priorityCount > 6 ? (
              <Button asChild size="sm" variant="ghost">
                <Link href="/jobs?filter=attention">See everything</Link>
              </Button>
            ) : null
          }
        >
          {priorityCount > 0 ? (
            <div className="priority-list">
              {priorities.slice(0, 6).map((item) => (
                <Link className="priority-row" href={item.href} key={item.id}>
                  <span className={`priority-row__icon priority-row__icon--${item.kind}`} aria-hidden="true">
                    {item.kind === "message" ? "✉" : item.kind === "task" ? "✓" : "!"}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="priority-row__title">{item.title}</span>
                    <span className="priority-row__detail">{item.detail}</span>
                  </span>
                  <span className="priority-row__action">Open</span>
                </Link>
              ))}
            </div>
          ) : (
            <div className="today-empty">
              <span aria-hidden="true">✓</span>
              <p>No urgent actions right now.</p>
            </div>
          )}
        </PageSection>

        <div className="grid gap-4 lg:grid-cols-2">
          <PageSection
            kicker={surveysToday.length > 0 ? "Today" : "Coming up"}
            title={
              surveysToday.length > 0
                ? `${surveysToday.length} ${surveysToday.length === 1 ? "site visit" : "site visits"} today`
                : nextSurvey
                  ? "Your next visit"
                  : "No visits booked"
            }
            actions={
              <Button asChild size="sm" variant="ghost">
                <Link href="/calendar">Open calendar</Link>
              </Button>
            }
          >
            {surveysToday.length > 0 ? (
              <TodayJobsGrid jobs={surveysToday} />
            ) : nextSurvey ? (
              <div>
                <p className="text-sm font-semibold text-[var(--text)]">{nextSurvey.customer?.full_name ?? nextSurvey.job_title}</p>
                <p className="mt-1 text-xs text-[var(--text-muted)]">{formatDate(nextSurvey.survey_date)}</p>
                <Button asChild className="mt-3" size="sm" variant="ghost">
                  <Link href={`/jobs/${nextSurvey.id}` as Route}>Open job</Link>
                </Button>
              </div>
            ) : (
              <p className="text-sm text-[var(--text-muted)]">Use the calendar when you are ready to book a survey or site visit.</p>
            )}
          </PageSection>

          <Card padding="lg">
            <p className="section-kicker">Weather</p>
            <h2 className="mt-2 text-xl">Plan outdoor work</h2>
            <p className="mt-2 text-sm text-[var(--text-muted)]">Forecast for {business.weather_location ?? "Yateley"}.</p>
            <div className="mt-4">
              <WeatherStrip location={business.weather_location ?? "Yateley"} />
            </div>
          </Card>
        </div>

        {recentJobs.length > 0 ? (
          <PageSection
            kicker="Pick up where you left off"
            title="Recently updated jobs"
            actions={
              <Button asChild size="sm" variant="ghost">
                <Link href="/jobs">View all jobs</Link>
              </Button>
            }
          >
            <div className="grid gap-3">
              {recentJobs.map((job) => <JobCard compact job={job} key={job.id} list />)}
            </div>
          </PageSection>
        ) : null}
      </div>
    </AppShell>
  );
}

function SummaryCard({ href, label, value, urgent = false }: { href: Route; label: string; value: number; urgent?: boolean }) {
  return (
    <Link className={`summary-card ${urgent ? "summary-card--urgent" : ""}`} href={href}>
      <span className="summary-card__value">{value}</span>
      <span className="summary-card__label">{label}</span>
      <span className="summary-card__arrow" aria-hidden="true">→</span>
    </Link>
  );
}

function QuickAction({ href, icon, label }: { href: Route; icon: string; label: string }) {
  return (
    <Link className="today-quick-action" href={href}>
      <span aria-hidden="true">{icon}</span>
      {label}
    </Link>
  );
}

function getGreeting(date: Date): string {
  const hour = date.getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}
