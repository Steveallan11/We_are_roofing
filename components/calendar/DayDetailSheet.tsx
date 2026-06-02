"use client";

import Link from "next/link";
import type { Route } from "next";
import { formatDate } from "@/lib/utils";

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

type Props = {
  date: string | null;
  events: CalendarEvent[];
  onClose: () => void;
};

export function DayDetailSheet({ date, events, onClose }: Props) {
  if (!date) return null;

  const dayEvents = events.filter((event) => event.date === date);
  const dateObj = new Date(date);

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div
        className="fixed bottom-0 left-0 right-0 max-h-[80vh] overflow-y-auto rounded-t-3xl border-t border-[var(--border)] bg-[var(--surface)] p-5 md:right-auto md:w-96 md:rounded-2xl md:border"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="section-kicker text-[0.65rem] uppercase">Daily Schedule</p>
            <h2 className="mt-2 font-condensed text-2xl text-white">{formatDate(date)}</h2>
          </div>
          <button className="button-ghost !px-3 !py-2 text-sm" onClick={onClose} type="button">
            ✕
          </button>
        </div>

        <div className="mt-4 space-y-3">
          {dayEvents.length ? (
            dayEvents.map((event) => (
              <div key={event.id} className="rounded-2xl border border-[var(--border)] bg-black/20 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <span
                      className="inline-block rounded-full px-2 py-1 text-[0.65rem] font-bold uppercase tracking-[0.16em] text-white"
                      style={{ background: event.color }}
                    >
                      {event.badge}
                    </span>
                    <p className="mt-2 font-semibold text-white">{event.title}</p>
                    <p className="mt-1 text-sm text-[var(--muted)]">
                      {event.time ? event.time : event.kind === "follow-up" ? "Any time" : "08:00"} | {event.address || "Address not set"}
                    </p>
                    {event.notes && <p className="mt-2 text-sm text-[var(--text)]">{event.notes}</p>}
                  </div>
                  {event.jobId && (
                    <Link className="button-secondary !px-3 !py-2 text-xs" href={`/jobs/${event.jobId}` as Route}>
                      Open
                    </Link>
                  )}
                </div>
              </div>
            ))
          ) : (
            <p className="rounded-2xl border border-[var(--border)] bg-black/20 p-4 text-sm text-[var(--muted)]">No events scheduled for this day.</p>
          )}
        </div>
      </div>
    </div>
  );
}
