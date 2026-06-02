"use client";

import { useState } from "react";
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
};

type Props = {
  events: CalendarEvent[];
  onSelectDate: (date: string) => void;
  onReschedule: (eventId: string, eventKind: CalendarEvent["kind"], newDate: string, jobId?: string) => Promise<void>;
};

export function MonthView({ events, onSelectDate, onReschedule }: Props) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [draggingEvent, setDraggingEvent] = useState<CalendarEvent | null>(null);
  const [isRescheduling, setIsRescheduling] = useState(false);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startDate = new Date(firstDay);
  startDate.setDate(startDate.getDate() - firstDay.getDay());

  const days = [];
  const current = new Date(startDate);
  while (current <= lastDay) {
    days.push(new Date(current));
    current.setDate(current.getDate() + 1);
  }

  const weeks = [];
  for (let i = 0; i < days.length; i += 7) {
    weeks.push(days.slice(i, i + 7));
  }

  const getEventsForDate = (date: Date) => {
    const dateStr = date.toISOString().split("T")[0];
    return events.filter((event) => event.date === dateStr);
  };

  const handleDragStart = (e: React.DragEvent, event: CalendarEvent) => {
    setDraggingEvent(event);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };

  const handleDrop = async (e: React.DragEvent, targetDate: Date) => {
    e.preventDefault();
    if (!draggingEvent) return;

    const newDateStr = targetDate.toISOString().split("T")[0];
    if (newDateStr === draggingEvent.date) {
      setDraggingEvent(null);
      return;
    }

    setIsRescheduling(true);
    try {
      await onReschedule(draggingEvent.id, draggingEvent.kind, newDateStr, draggingEvent.jobId ?? undefined);
    } finally {
      setIsRescheduling(false);
      setDraggingEvent(null);
    }
  };

  const prevMonth = () => setCurrentDate(new Date(year, month - 1));
  const nextMonth = () => setCurrentDate(new Date(year, month + 1));
  const monthName = currentDate.toLocaleDateString("en-GB", { month: "long", year: "numeric" });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-white">{monthName}</h3>
        <div className="flex gap-2">
          <button className="button-ghost !px-3 !py-2 text-sm" onClick={prevMonth} type="button" disabled={isRescheduling}>
            ← Prev
          </button>
          <button className="button-ghost !px-3 !py-2 text-sm" onClick={nextMonth} type="button" disabled={isRescheduling}>
            Next →
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-1 rounded-2xl border border-[var(--border)] bg-black/20 p-3">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
          <div key={day} className="pb-2 text-center text-xs font-bold uppercase text-[var(--dim)]">
            {day}
          </div>
        ))}

        {weeks.map((week, weekIdx) =>
          week.map((date, dayIdx) => {
            const isCurrentMonth = date.getMonth() === month;
            const dateStr = date.toISOString().split("T")[0];
            const dayEvents = getEventsForDate(date);
            const isToday = dateStr === new Date().toISOString().split("T")[0];

            return (
              <div
                key={`${weekIdx}-${dayIdx}`}
                className={`min-h-24 rounded-lg border p-2 transition ${
                  isCurrentMonth ? "border-[var(--border)] bg-[var(--surface)]" : "border-[var(--border-mid)] bg-[var(--surface-deep)]"
                } ${isToday ? "ring-2 ring-[var(--gold)]" : ""} ${draggingEvent ? "cursor-grab" : ""}`}
                onClick={() => isCurrentMonth && onSelectDate(dateStr)}
                onDragOver={handleDragOver}
                onDrop={(e) => handleDrop(e, date)}
              >
                <p className={`text-xs font-semibold ${isCurrentMonth ? "text-white" : "text-[var(--text-faint)]"}`}>{date.getDate()}</p>
                <div className="mt-1 flex flex-wrap gap-1">
                  {dayEvents.slice(0, 2).map((event) => (
                    <div
                      key={event.id}
                      className="w-full cursor-move rounded px-1.5 py-0.5 text-[0.5rem] font-bold text-white opacity-90 transition hover:opacity-100"
                      draggable
                      onDragStart={(e) => handleDragStart(e, event)}
                      style={{ background: event.color }}
                      title={event.title}
                    >
                      {event.badge}
                    </div>
                  ))}
                  {dayEvents.length > 2 && (
                    <p className="w-full text-center text-[0.5rem] text-[var(--text-muted)]">+{dayEvents.length - 2}</p>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      <div className="text-sm text-[var(--text-muted)]">
        💡 Click a day for details. Drag events to reschedule.
      </div>
    </div>
  );
}
