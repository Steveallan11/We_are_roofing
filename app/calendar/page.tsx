import Link from "next/link";
import type { Route } from "next";
import { AppShell } from "@/components/layout/app-shell";
import { Badge, Button, Card, PageSection, Stat } from "@/components/ui/primitives";
import { getBookings, getJobs } from "@/lib/data";
import { googleCalendarLink } from "@/lib/calendar/generateICS";
import { formatDate } from "@/lib/utils";
import { MonthViewClient } from "@/components/calendar/MonthViewClient";
import { WeekViewClient } from "@/components/calendar/WeekViewClient";

type CalendarEvent = {
  id: string;
  kind: "survey" | "works" | "follow-up" | "inspection" | "other";
  date: string;
  title: string;
  address: string;
  jobId?: string | null;
  time?: string;
  duration: number;
  color: string;
  badge: string;
  status?: string | null;
  notes?: string | null;
};

const FILTERS = [
  { id: "all", label: "All" },
  { id: "survey", label: "Surveys" },
  { id: "works", label: "Works" },
  { id: "follow-up", label: "Follow-ups" }
] as const;

export default async function CalendarPage({ searchParams }: { searchParams?: Promise<{ view?: string; display?: string }> }) {
  const [params, bookings, jobs] = await Promise.all([
    searchParams ?? Promise.resolve({ view: undefined as string | undefined, display: undefined as string | undefined }),
    getBookings(),
    getJobs()
  ]);
  const view = params.view;
  const defaultDisplay = "week";
  const display = params.display ?? defaultDisplay;
  const activeView: string = FILTERS.some((filter) => filter.id === view) && view ? view : "all";

  const startDates: CalendarEvent[] = jobs
    .filter((job) => job.start_date)
    .map((job) => ({
      id: `start-${job.id}`,
      kind: "works",
      date: job.start_date!,
      title: `Works start - ${job.job_ref ?? job.job_title}`,
      address: job.property_address,
      jobId: job.id,
      duration: 480,
      color: "#10b981",
      badge: "Works",
      status: job.status
    }));

  const followUps: CalendarEvent[] = jobs
    .filter((job) => job.follow_up_date)
    .map((job) => ({
      id: `follow-${job.id}`,
      kind: "follow-up",
      date: job.follow_up_date!,
      title: `Follow up - ${job.job_ref ?? job.job_title}`,
      address: job.property_address,
      jobId: job.id,
      duration: 30,
      color: "#8b5cf6",
      badge: "Follow-up",
      status: job.status
    }));

  const bookingEvents: CalendarEvent[] = bookings.map((booking) => {
    const kind = getBookingKind(booking.booking_type);
    return {
      id: booking.id,
      kind,
      date: booking.date,
      title: booking.title || getBookingTitle(booking.booking_type),
      address: booking.address || booking.job?.property_address || "",
      jobId: booking.job_id,
      time: booking.time_start?.slice(0, 5),
      duration: Number(booking.duration_mins ?? 60),
      color: getEventColor(kind),
      badge: getEventBadge(kind),
      status: booking.status,
      notes: booking.notes
    };
  });

  const now = new Date();
  const events = [...bookingEvents, ...startDates, ...followUps].sort((left, right) =>
    `${left.date}${left.time ?? ""}`.localeCompare(`${right.date}${right.time ?? ""}`)
  );
  const upcomingEvents = events.filter(
    (event) => new Date(`${event.date}T${event.time ?? "23:59"}`).getTime() >= now.getTime()
  );
  const visibleEvents =
    activeView === "all" ? upcomingEvents : upcomingEvents.filter((event) => event.kind === activeView);
  const groupedEvents = groupEventsByDate(visibleEvents);
  const nextEvent = upcomingEvents[0] ?? null;

  return (
    <AppShell title="Calendar" subtitle="Survey bookings, works starts, follow-ups, and operational diary in one place.">
      <div className="stack">
        <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Stat
            label="Next event"
            value={nextEvent ? formatDate(nextEvent.date) : "None"}
            hint={nextEvent?.title ?? "No upcoming dated work"}
          />
          <Stat
            label="Surveys"
            value={String(upcomingEvents.filter((event) => event.kind === "survey").length)}
            hint="Upcoming visits"
            tone="pending"
          />
          <Stat
            label="Works starts"
            value={String(upcomingEvents.filter((event) => event.kind === "works").length)}
            hint="Jobs starting"
            tone="active"
          />
          <Stat
            label="Follow-ups"
            value={String(upcomingEvents.filter((event) => event.kind === "follow-up").length)}
            hint="Customer chases"
            tone="alert"
          />
        </section>

        <PageSection
          kicker={
            display === "month"
              ? "Month View"
              : display === "week"
                ? "Week View"
                : "Diary View"
          }
          title="Upcoming schedule"
          actions={
            <div className="flex flex-col gap-2 md:flex-row md:items-center">
              <div className="flex gap-1 overflow-x-auto pb-1">
                {FILTERS.map((filter) => {
                  const active = activeView === filter.id;
                  return (
                    <Button
                      key={filter.id}
                      variant={active ? "primary" : "subtle"}
                      size="sm"
                      asChild
                      className="rounded-full shrink-0"
                    >
                      <Link href={`/calendar?view=${filter.id}&display=${display}` as Route}>{filter.label}</Link>
                    </Button>
                  );
                })}
              </div>
              <div className="flex gap-1">
                <Button variant={display === "week" ? "primary" : "subtle"} size="sm" asChild className="rounded-full">
                  <Link href={`/calendar?view=${activeView}&display=week` as Route}>Week</Link>
                </Button>
                <Button variant={display === "month" ? "primary" : "subtle"} size="sm" asChild className="rounded-full">
                  <Link href={`/calendar?view=${activeView}&display=month` as Route}>Month</Link>
                </Button>
                <Button variant={display === "list" ? "primary" : "subtle"} size="sm" asChild className="rounded-full">
                  <Link href={`/calendar?view=${activeView}&display=list` as Route}>List</Link>
                </Button>
              </div>
            </div>
          }
        >
          {display === "month" ? (
            <MonthViewClient events={visibleEvents} filterView={activeView} />
          ) : display === "week" ? (
            <WeekViewClient events={visibleEvents} filterView={activeView} />
          ) : (
            <div className="grid gap-5">
              {groupedEvents.length ? (
                groupedEvents.map((group) => (
                  <div key={group.date}>
                    <div className="mb-3 flex items-center justify-between gap-3 border-b border-[var(--border)] pb-2">
                      <p className="text-sm font-semibold text-[var(--text)]">{formatDate(group.date)}</p>
                      <p className="text-xs text-[var(--text-muted)]">
                        {group.events.length} event{group.events.length === 1 ? "" : "s"}
                      </p>
                    </div>
                    <div className="grid gap-3">
                      {group.events.map((event) => (
                        <CalendarEventCard event={event} key={event.id} />
                      ))}
                    </div>
                  </div>
                ))
              ) : (
                <p className="rounded-lg border border-dashed border-[var(--border-mid)] p-5 text-center text-sm text-[var(--text-muted)]">
                  No upcoming events for this view.
                </p>
              )}
            </div>
          )}
        </PageSection>
      </div>
    </AppShell>
  );
}

function CalendarEventCard({ event }: { event: CalendarEvent }) {
  const timeLabel = event.time ? event.time : event.kind === "follow-up" ? "Any time" : "08:00";
  const calendarTitle = event.kind === "survey" ? `Roof Survey - ${event.title}` : event.title;
  const badgeVariant = getBadgeVariant(event.kind);

  return (
    <Card variant="outlined" padding="md" className="grid gap-3 md:grid-cols-[6px_1fr_auto]">
      <span className="hidden md:block rounded-full min-h-12" style={{ background: event.color }} aria-hidden />
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={badgeVariant} size="sm">{event.badge}</Badge>
          {event.status ? <span className="text-xs text-[var(--text-muted)]">{event.status}</span> : null}
        </div>
        <p className="mt-2 text-sm font-semibold text-[var(--text)]">{event.title}</p>
        <p className="mt-0.5 text-xs text-[var(--text-muted)]">
          {timeLabel} · {event.address || "Address not set"}
        </p>
        {event.notes ? <p className="mt-2 text-sm text-[var(--text-second)]">{event.notes}</p> : null}
      </div>
      <div className="flex flex-wrap gap-2 md:justify-end">
        {event.jobId ? (
          <Button variant="secondary" size="sm" asChild>
            <Link href={`/jobs/${event.jobId}` as Route}>Open Job</Link>
          </Button>
        ) : null}
        <Button variant="ghost" size="sm" asChild>
          <a
            href={googleCalendarLink({
              title: event.title,
              calendarTitle,
              date: event.date,
              timeStart: event.time || (event.kind === "follow-up" ? "09:00" : "08:00"),
              duration: event.duration,
              address: event.address,
              notes: event.notes ?? "",
              jobRef: event.title
            })}
            rel="noreferrer"
            target="_blank"
          >
            Calendar
          </a>
        </Button>
      </div>
    </Card>
  );
}

function getBadgeVariant(kind: CalendarEvent["kind"]) {
  if (kind === "survey") return "pending" as const;
  if (kind === "works") return "active" as const;
  if (kind === "follow-up") return "alert" as const;
  return "neutral" as const;
}

function groupEventsByDate(events: CalendarEvent[]) {
  const groups = new Map<string, CalendarEvent[]>();
  for (const event of events) {
    groups.set(event.date, [...(groups.get(event.date) ?? []), event]);
  }
  return Array.from(groups.entries()).map(([date, grouped]) => ({ date, events: grouped }));
}

function getBookingKind(type: string): CalendarEvent["kind"] {
  if (type === "survey") return "survey";
  if (type === "start") return "works";
  if (type === "inspection") return "inspection";
  return "other";
}

function getBookingTitle(type: string) {
  if (type === "survey") return "Roof survey";
  if (type === "start") return "Works start";
  if (type === "inspection") return "Inspection";
  return "Diary booking";
}

function getEventBadge(kind: CalendarEvent["kind"]) {
  if (kind === "survey") return "Survey";
  if (kind === "works") return "Works";
  if (kind === "follow-up") return "Follow-up";
  if (kind === "inspection") return "Inspection";
  return "Diary";
}

function getEventColor(kind: CalendarEvent["kind"]) {
  if (kind === "survey") return "#f59e0b";
  if (kind === "works") return "#10b981";
  if (kind === "follow-up") return "#8b5cf6";
  if (kind === "inspection") return "#3b82f6";
  return "#64748b";
}
