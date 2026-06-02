import Link from "next/link";
import type { Route } from "next";
import { AppShell } from "@/components/layout/app-shell";
import { getBookings, getJobs } from "@/lib/data";
import { googleCalendarLink } from "@/lib/calendar/generateICS";
import { formatDate } from "@/lib/utils";
import { MonthViewClient } from "@/components/calendar/MonthViewClient";

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
  const [params, bookings, jobs] = await Promise.all([searchParams ?? Promise.resolve({ view: undefined as string | undefined, display: "month" as string | undefined }), getBookings(), getJobs()]);
  const view = params.view;
  const display = params.display ?? "month";
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
  const events = [...bookingEvents, ...startDates, ...followUps].sort((left, right) => `${left.date}${left.time ?? ""}`.localeCompare(`${right.date}${right.time ?? ""}`));
  const upcomingEvents = events.filter((event) => new Date(`${event.date}T${event.time ?? "23:59"}`).getTime() >= now.getTime());
  const visibleEvents = activeView === "all" ? upcomingEvents : upcomingEvents.filter((event) => event.kind === activeView);
  const groupedEvents = groupEventsByDate(visibleEvents);
  const nextEvent = upcomingEvents[0] ?? null;

  return (
    <AppShell title="Calendar" subtitle="Survey bookings, works starts, follow-ups, and operational diary in one place.">
      <div className="stack">
        <section className="grid gap-3 md:grid-cols-4">
          <CalendarStat label="Next event" value={nextEvent ? formatDate(nextEvent.date) : "None booked"} hint={nextEvent?.title ?? "No upcoming dated work"} />
          <CalendarStat label="Surveys" value={String(upcomingEvents.filter((event) => event.kind === "survey").length)} hint="Upcoming survey visits" />
          <CalendarStat label="Works starts" value={String(upcomingEvents.filter((event) => event.kind === "works").length)} hint="Jobs with start dates" />
          <CalendarStat label="Follow-ups" value={String(upcomingEvents.filter((event) => event.kind === "follow-up").length)} hint="Customer chase dates" />
        </section>

        <section className="card p-5">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="section-kicker text-[0.65rem] uppercase">{display === "month" ? "Month View" : "Diary View"}</p>
              <h2 className="mt-2 font-condensed text-3xl text-white">Upcoming schedule</h2>
            </div>
            <div className="flex flex-col gap-3 md:flex-row md:items-center">
              <div className="flex gap-2 overflow-x-auto pb-1">
                {FILTERS.map((filter) => {
                  const active = activeView === filter.id;
                  return (
                    <Link
                      className={`shrink-0 rounded-full border px-3 py-2 text-xs font-bold uppercase tracking-[0.14em] transition ${
                        active ? "border-[var(--gold)] bg-[var(--gold)] text-black" : "border-[var(--border)] bg-black/20 text-[var(--muted)] hover:border-[var(--gold)]/60"
                      }`}
                      href={`/calendar?view=${filter.id}&display=${display}` as Route}
                      key={filter.id}
                    >
                      {filter.label}
                    </Link>
                  );
                })}
              </div>
              <div className="flex gap-1 rounded-2xl border border-[var(--border)] bg-black/20 p-1">
                <Link
                  className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${
                    display === "month" ? "bg-[var(--gold)] text-black" : "text-[var(--muted)]"
                  }`}
                  href={`/calendar?view=${activeView}&display=month` as Route}
                >
                  Month
                </Link>
                <Link
                  className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${
                    display === "list" ? "bg-[var(--gold)] text-black" : "text-[var(--muted)]"
                  }`}
                  href={`/calendar?view=${activeView}&display=list` as Route}
                >
                  List
                </Link>
              </div>
            </div>
          </div>

          <div className="mt-5">
            {display === "month" ? (
              <MonthViewClient events={visibleEvents} filterView={activeView} />
            ) : (
              <div className="grid gap-5">
                {groupedEvents.length ? (
                  groupedEvents.map((group) => (
                    <div key={group.date}>
                      <div className="mb-3 flex items-center justify-between gap-3 border-b border-[var(--border)] pb-2">
                        <p className="font-semibold text-white">{formatDate(group.date)}</p>
                        <p className="text-xs text-[var(--muted)]">{group.events.length} event{group.events.length === 1 ? "" : "s"}</p>
                      </div>
                      <div className="grid gap-3">
                        {group.events.map((event) => (
                          <CalendarEventCard event={event} key={event.id} />
                        ))}
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="rounded-2xl border border-[var(--border)] bg-black/20 p-5 text-sm text-[var(--muted)]">No upcoming events for this view.</p>
                )}
              </div>
            )}
          </div>
        </section>
      </div>
    </AppShell>
  );
}

function CalendarEventCard({ event }: { event: CalendarEvent }) {
  const timeLabel = event.time ? event.time : event.kind === "follow-up" ? "Any time" : "08:00";
  const calendarTitle = event.kind === "survey" ? `Roof Survey - ${event.title}` : event.title;

  return (
    <div className="grid gap-3 rounded-2xl border border-[var(--border)] bg-black/20 p-4 md:grid-cols-[10px_1fr_auto]">
      <span className="h-full min-h-12 rounded-full" style={{ background: event.color }} />
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full border border-[var(--border)] bg-black/20 px-2.5 py-1 text-[0.65rem] font-bold uppercase tracking-[0.16em] text-[var(--dim)]">{event.badge}</span>
          {event.status ? <span className="text-xs text-[var(--muted)]">{event.status}</span> : null}
        </div>
        <p className="mt-2 font-semibold text-white">{event.title}</p>
        <p className="mt-1 text-sm text-[var(--muted)]">
          {timeLabel} | {event.address || "Address not set"}
        </p>
        {event.notes ? <p className="mt-2 text-sm text-[var(--text)]">{event.notes}</p> : null}
      </div>
      <div className="flex flex-wrap gap-2 md:justify-end">
        {event.jobId ? (
          <Link className="button-secondary !px-3 !py-2 text-xs" href={`/jobs/${event.jobId}` as Route}>
            Open Job
          </Link>
        ) : null}
        <a
          className="button-ghost !px-3 !py-2 text-xs"
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
          Google Calendar
        </a>
      </div>
    </div>
  );
}

function CalendarStat({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="rounded-2xl border border-[var(--border)] bg-black/20 p-4">
      <p className="text-[0.62rem] font-bold uppercase tracking-[0.2em] text-[var(--dim)]">{label}</p>
      <p className="mt-2 text-xl font-semibold text-white">{value}</p>
      <p className="mt-1 truncate text-xs text-[var(--muted)]">{hint}</p>
    </div>
  );
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
