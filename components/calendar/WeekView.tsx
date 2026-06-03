"use client";

import { useState } from "react";
import Link from "next/link";
import type { Route } from "next";
import { Button } from "@/components/ui/primitives";
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
  events: CalendarEvent[];
  onReschedule: (eventId: string, eventKind: CalendarEvent["kind"], newDate: string, jobId?: string) => Promise<void>;
};

export function WeekView({ events, onReschedule }: Props) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [reschedueling, setRescheduling] = useState(false);
  const [rescheduleEventId, setRescheduleEventId] = useState<string | null>(null);

  const weekStart = new Date(currentDate);
  weekStart.setDate(currentDate.getDate() - currentDate.getDay());

  const days: Date[] = [];
  for (let i = 0; i < 7; i++) {
    const day = new Date(weekStart);
    day.setDate(weekStart.getDate() + i);
    days.push(day);
  }

  const getEventsForDate = (date: Date) => {
    const dateStr = date.toISOString().split("T")[0];
    return events.filter((event) => event.date === dateStr);
  };

  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  const goToPreviousWeek = () => {
    const newDate = new Date(currentDate);
    newDate.setDate(currentDate.getDate() - 7);
    setCurrentDate(newDate);
  };

  const goToNextWeek = () => {
    const newDate = new Date(currentDate);
    newDate.setDate(currentDate.getDate() + 7);
    setCurrentDate(newDate);
  };

  const handleReschedule = async (event: CalendarEvent, newDate: Date) => {
    setRescheduling(true);
    try {
      const newDateStr = newDate.toISOString().split("T")[0];
      await onReschedule(event.id, event.kind, newDateStr, event.jobId ?? undefined);
      setRescheduleEventId(null);
    } catch (error) {
      console.error("Reschedule error:", error);
      alert(error instanceof Error ? error.message : "Failed to reschedule event");
    } finally {
      setRescheduling(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <Button variant="ghost" size="sm" onClick={goToPreviousWeek} disabled={reschedueling}>
          ← Previous
        </Button>
        <p className="text-sm font-medium text-[var(--text)]">
          {formatDate(days[0].toISOString().split("T")[0])} – {formatDate(days[6].toISOString().split("T")[0])}
        </p>
        <Button variant="ghost" size="sm" onClick={goToNextWeek} disabled={reschedueling}>
          Next →
        </Button>
      </div>

      <div className="grid grid-cols-7 gap-2">
        {days.map((day, idx) => {
          const dayEvents = getEventsForDate(day);
          const isToday = new Date().toISOString().split("T")[0] === day.toISOString().split("T")[0];

          return (
            <div
              key={day.toISOString()}
              className={`rounded-lg border p-3 ${
                isToday
                  ? "border-[var(--gold)] bg-[var(--gold)]/10"
                  : "border-[var(--border)] bg-[var(--surface)]"
              }`}
            >
              <p className={`text-xs font-semibold text-center ${isToday ? "text-[var(--gold)]" : "text-[var(--text-muted)]"}`}>
                {dayNames[idx]}
              </p>
              <p className={`text-center text-lg font-bold ${isToday ? "text-[var(--gold)]" : "text-[var(--text)]"}`}>
                {day.getDate()}
              </p>
              <div className="mt-2 space-y-1">
                {dayEvents.length > 0 ? (
                  dayEvents.slice(0, 2).map((event) => (
                    <button
                      key={event.id}
                      onClick={() => setRescheduleEventId(event.id)}
                      className="block w-full text-left"
                    >
                      <div
                        className="rounded px-2 py-1 text-[10px] font-semibold text-white truncate hover:opacity-80 transition-opacity"
                        style={{ backgroundColor: event.color }}
                        title={event.title}
                      >
                        {event.badge}
                      </div>
                    </button>
                  ))
                ) : (
                  <div className="h-5" />
                )}
                {dayEvents.length > 2 && (
                  <p className="text-[10px] text-[var(--text-muted)] px-2">
                    +{dayEvents.length - 2} more
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="space-y-3">
        {days.map((day) => {
          const dayEvents = getEventsForDate(day);
          if (dayEvents.length === 0) return null;

          return (
            <div key={day.toISOString()}>
              <p className="text-sm font-semibold text-[var(--text)] mb-2">{formatDate(day.toISOString().split("T")[0])}</p>
              <div className="space-y-2">
                {dayEvents.map((event) => (
                  <div
                    key={event.id}
                    className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3 space-y-2"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <span
                          className="inline-block rounded px-2 py-1 text-[10px] font-semibold text-white"
                          style={{ backgroundColor: event.color }}
                        >
                          {event.badge}
                        </span>
                        <p className="mt-2 text-sm font-semibold text-[var(--text)] line-clamp-2">{event.title}</p>
                        <p className="mt-1 text-xs text-[var(--text-muted)]">
                          {event.time ? event.time : event.kind === "follow-up" ? "Any time" : "08:00"}
                        </p>
                        {event.address && (
                          <p className="text-xs text-[var(--text-muted)] line-clamp-1">{event.address}</p>
                        )}
                      </div>
                      {event.jobId && (
                        <Link href={`/jobs/${event.jobId}` as Route} className="shrink-0">
                          <Button variant="secondary" size="sm">
                            Open
                          </Button>
                        </Link>
                      )}
                    </div>

                    {rescheduleEventId === event.id && (
                      <RescheduleMenu
                        event={event}
                        days={days}
                        currentDate={currentDate}
                        onReschedule={handleReschedule}
                        onCancel={() => setRescheduleEventId(null)}
                        isLoading={reschedueling}
                      />
                    )}

                    {rescheduleEventId !== event.id && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="w-full"
                        onClick={() => setRescheduleEventId(event.id)}
                        disabled={reschedueling}
                      >
                        Reschedule
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function RescheduleMenu({
  event,
  days,
  currentDate,
  onReschedule,
  onCancel,
  isLoading,
}: {
  event: CalendarEvent;
  days: Date[];
  currentDate: Date;
  onReschedule: (event: CalendarEvent, newDate: Date) => Promise<void>;
  onCancel: () => void;
  isLoading: boolean;
}) {
  const weekStart = new Date(currentDate);
  weekStart.setDate(currentDate.getDate() - currentDate.getDay());

  const nextWeekStart = new Date(weekStart);
  nextWeekStart.setDate(weekStart.getDate() + 7);

  const nextWeekDays: Date[] = [];
  for (let i = 0; i < 7; i++) {
    const day = new Date(nextWeekStart);
    day.setDate(nextWeekStart.getDate() + i);
    nextWeekDays.push(day);
  }

  return (
    <div className="space-y-2 pt-2 border-t border-[var(--border)]">
      <p className="text-xs font-medium text-[var(--text-muted)]">This week</p>
      <div className="grid grid-cols-4 gap-1">
        {days.map((day) => {
          const dateStr = day.toISOString().split("T")[0];
          const isCurrentDate = dateStr === event.date;
          return (
            <Button
              key={dateStr}
              variant={isCurrentDate ? "primary" : "secondary"}
              size="sm"
              onClick={() => onReschedule(event, day)}
              disabled={isLoading}
              className="text-xs"
            >
              {day.getDate()}
            </Button>
          );
        })}
      </div>

      <p className="text-xs font-medium text-[var(--text-muted)] pt-2">Next week</p>
      <div className="grid grid-cols-4 gap-1">
        {nextWeekDays.map((day) => (
          <Button
            key={day.toISOString()}
            variant="secondary"
            size="sm"
            onClick={() => onReschedule(event, day)}
            disabled={isLoading}
            className="text-xs"
          >
            {day.getDate()}
          </Button>
        ))}
      </div>

      <Button variant="ghost" size="sm" className="w-full" onClick={onCancel} disabled={isLoading}>
        Cancel
      </Button>
    </div>
  );
}
