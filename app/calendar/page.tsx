import Link from "next/link";
import type { Route } from "next";
import { AppShell } from "@/components/layout/app-shell";
import { getBookings, getJobs } from "@/lib/data";
import { googleCalendarLink } from "@/lib/calendar/generateICS";
import { formatDate } from "@/lib/utils";

export default async function CalendarPage() {
  const [bookings, jobs] = await Promise.all([getBookings(), getJobs()]);
  type CalendarEvent = {
    id: string;
    type: string;
    date: string;
    title: string;
    address: string;
    jobId?: string | null;
    time?: string;
    color: string;
  };
  const startDates: CalendarEvent[] = jobs
    .filter((job) => job.start_date)
    .map((job) => ({
      id: `start-${job.id}`,
      type: "start",
      date: job.start_date!,
      title: `Works start - ${job.job_ref ?? job.job_title}`,
      address: job.property_address,
      jobId: job.id,
      color: "#10b981"
    }));
  const followUps: CalendarEvent[] = jobs
    .filter((job) => job.follow_up_date)
    .map((job) => ({
      id: `follow-${job.id}`,
      type: "follow-up",
      date: job.follow_up_date!,
      title: `Follow up - ${job.job_ref ?? job.job_title}`,
      address: job.property_address,
      jobId: job.id,
      color: "#8b5cf6"
    }));
  const bookingEvents: CalendarEvent[] = bookings.map((booking) => ({
    id: booking.id,
    type: booking.booking_type,
    date: booking.date,
    title: booking.title || booking.booking_type,
    address: booking.address || booking.job?.property_address || "",
    jobId: booking.job_id,
    time: booking.time_start?.slice(0, 5),
    color: booking.booking_type === "survey" ? "#f59e0b" : "#10b981"
  }));

  const events = [...bookingEvents, ...startDates, ...followUps].sort((left, right) => `${left.date}${left.time ?? ""}`.localeCompare(`${right.date}${right.time ?? ""}`));

  return (
    <AppShell title="Calendar" subtitle="Survey bookings, job start dates, follow-ups and operational diary in one place.">
      <div className="card p-5">
        <p className="section-kicker text-[0.65rem] uppercase">Upcoming diary</p>
        <div className="mt-5 grid gap-3">
          {events.length ? (
            events.map((event) => (
              <div className="grid gap-3 rounded-2xl border border-[var(--border)] bg-black/20 p-4 md:grid-cols-[10px_1fr_auto]" key={event.id}>
                <span className="h-full min-h-12 rounded-full" style={{ background: event.color }} />
                <div>
                  <p className="font-semibold text-white">{event.title}</p>
                  <p className="mt-1 text-sm text-[var(--muted)]">
                    {formatDate(event.date)} {event.time ? `at ${event.time}` : ""} · {event.address}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {event.jobId ? (
                    <Link className="button-secondary !px-3 !py-2 text-xs" href={`/jobs/${event.jobId}` as Route}>
                      Open Job
                    </Link>
                  ) : null}
                  <a
                    className="button-ghost !px-3 !py-2 text-xs"
                    href={googleCalendarLink({
                      title: event.title,
                      date: event.date,
                      timeStart: event.time || "09:00",
                      duration: 60,
                      address: event.address,
                      jobRef: event.title
                    })}
                    rel="noreferrer"
                    target="_blank"
                  >
                    Add to Google
                  </a>
                </div>
              </div>
            ))
          ) : (
            <p className="text-sm text-[var(--muted)]">No bookings or dated work yet.</p>
          )}
        </div>
      </div>
    </AppShell>
  );
}
