"use client";

import { useEffect, useState } from "react";

type Reminder = {
  id: string;
  entry_type: string;
  title: string | null;
  body: string | null;
  reminder_time: string | null;
  is_due: boolean;
  linked_job_id: string | null;
};

export function ReminderList() {
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const loadReminders = async () => {
      try {
        const response = await fetch("/api/diary/reminders");
        const data = await response.json();
        if (cancelled) return;
        if (data?.ok) {
          setReminders(data.reminders ?? []);
        } else {
          setError(data?.error || "Unable to load reminders");
        }
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Error loading reminders");
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    loadReminders();
    const interval = setInterval(loadReminders, 30000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  const handleDone = async (id: string) => {
    setReminders((prev) => prev.filter((r) => r.id !== id));
    await fetch("/api/diary/reminders", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, action: "done" })
    });
  };

  const handleSnooze = async (id: string, minutes: number) => {
    setReminders((prev) => prev.filter((r) => r.id !== id));
    await fetch("/api/diary/reminders", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, action: "snooze", snooze_minutes: minutes })
    });
  };

  const overdue = reminders.filter((r) => r.is_due);
  const upcoming = reminders.filter((r) => !r.is_due);

  if (isLoading) {
    return <p className="text-xs text-[var(--text-muted)]">Loading…</p>;
  }

  if (error) {
    return <p className="text-xs text-[#fca5a5]">{error}</p>;
  }

  if (reminders.length === 0) {
    return <p className="text-xs text-[var(--text-muted)]">No reminders set.</p>;
  }

  return (
    <div className="space-y-3">
      {overdue.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-[#ef4444]">
            ⚠️ Overdue ({overdue.length})
          </p>
          {overdue.map((reminder) => (
            <ReminderCard key={reminder.id} reminder={reminder} onDone={handleDone} onSnooze={handleSnooze} />
          ))}
        </div>
      )}

      {upcoming.length > 0 && (
        <div className="space-y-2">
          {overdue.length > 0 && <p className="mt-4 text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">Upcoming</p>}
          {upcoming.map((reminder) => (
            <ReminderCard key={reminder.id} reminder={reminder} onDone={handleDone} onSnooze={handleSnooze} />
          ))}
        </div>
      )}
    </div>
  );
}

function ReminderCard({
  reminder,
  onDone,
  onSnooze
}: {
  reminder: Reminder;
  onDone: (id: string) => void;
  onSnooze: (id: string, minutes: number) => void;
}) {
  const time = reminder.reminder_time ? new Date(reminder.reminder_time) : null;
  const now = new Date();
  const isDue = reminder.is_due;

  const timeStr = time
    ? time.toLocaleString("en-GB", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })
    : "—";

  const diffMinutes = time ? Math.floor((time.getTime() - now.getTime()) / 60000) : 0;
  let statusText = timeStr;
  if (isDue) {
    const overdueMin = -diffMinutes;
    statusText = `Overdue ${overdueMin}m`;
  } else if (diffMinutes < 60) {
    statusText = `In ${diffMinutes}m`;
  }

  return (
    <div
      className={`rounded-lg border p-2 ${
        isDue ? "border-[#ef4444]/50 bg-[#ef4444]/5" : "border-[var(--border)] bg-[var(--ink)]"
      }`}
    >
      <div className="mb-1 flex items-start justify-between gap-2">
        <div className="min-w-0">
          {reminder.title && <p className="text-xs font-semibold text-[var(--text)]">{reminder.title}</p>}
          {reminder.body && <p className="text-xs text-[var(--text-muted)] line-clamp-1">{reminder.body}</p>}
        </div>
        <p className={`shrink-0 text-[10px] font-medium ${isDue ? "text-[#ef4444]" : "text-[var(--text-muted)]"}`}>
          {statusText}
        </p>
      </div>
      <div className="flex gap-1">
        <button
          type="button"
          onClick={() => onDone(reminder.id)}
          className="flex-1 rounded bg-[#10b981]/20 px-2 py-1 text-[10px] font-medium text-[#10b981] hover:bg-[#10b981]/30"
        >
          Done
        </button>
        <button
          type="button"
          onClick={() => onSnooze(reminder.id, 15)}
          className="flex-1 rounded bg-[var(--gold)]/20 px-2 py-1 text-[10px] font-medium text-[var(--gold)] hover:bg-[var(--gold)]/30"
        >
          15m
        </button>
        <button
          type="button"
          onClick={() => onSnooze(reminder.id, 60)}
          className="flex-1 rounded bg-[var(--gold)]/20 px-2 py-1 text-[10px] font-medium text-[var(--gold)] hover:bg-[var(--gold)]/30"
        >
          1h
        </button>
      </div>
    </div>
  );
}
