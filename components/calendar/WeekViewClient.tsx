"use client";

import { useState } from "react";
import { WeekView } from "./WeekView";

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

export function WeekViewClient({ events, filterView }: Props) {
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

      window.location.reload();
    } catch (error) {
      console.error("Reschedule error:", error);
      throw error;
    } finally {
      setIsRescheduling(false);
    }
  };

  const filteredEvents =
    filterView === "all" ? events : events.filter((event) => event.kind === filterView);

  return (
    <WeekView
      events={filteredEvents}
      onReschedule={handleReschedule}
    />
  );
}
