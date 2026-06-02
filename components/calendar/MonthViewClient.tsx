"use client";

import { useState } from "react";
import { MonthView } from "./MonthView";
import { DayDetailSheet } from "./DayDetailSheet";

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
  filterView: string;
};

export function MonthViewClient({ events, filterView }: Props) {
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [isRescheduling, setIsRescheduling] = useState(false);

  const handleReschedule = async (
    eventId: string,
    eventKind: CalendarEvent["kind"],
    newDate: string,
    jobId?: string
  ) => {
    setIsRescheduling(true);
    try {
      const response = await fetch("/api/calendar/reschedule", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventId,
          eventKind,
          newDate,
          jobId
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to reschedule event");
      }

      setSelectedDate(null);
      window.location.reload();
    } catch (error) {
      console.error("Reschedule error:", error);
      alert(error instanceof Error ? error.message : "Failed to reschedule event");
    } finally {
      setIsRescheduling(false);
    }
  };

  return (
    <>
      <MonthView
        events={events}
        onSelectDate={setSelectedDate}
        onReschedule={handleReschedule}
      />
      <DayDetailSheet
        date={selectedDate}
        events={events}
        onClose={() => setSelectedDate(null)}
      />
    </>
  );
}
