"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { googleCalendarLink } from "@/lib/calendar/generateICS";
import type { Job } from "@/lib/types";

export function ScheduleWorks({ job }: { job: Job }) {
  const router = useRouter();
  const [startDate, setStartDate] = useState(job.start_date ?? "");
  const [endDate, setEndDate] = useState(job.expected_end_date ?? "");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const calendarLink = useMemo(
    () =>
      startDate
        ? googleCalendarLink({
            title: job.job_title,
            date: startDate,
            timeStart: "08:00",
            duration: 480,
            address: job.property_address,
            notes: "Works start date",
            jobRef: job.job_ref ?? "WR-J-TBC"
          })
        : "#",
    [job.job_ref, job.job_title, job.property_address, startDate]
  );

  async function saveSchedule() {
    setError(null);
    setMessage(null);
    const response = await fetch(`/api/jobs/${job.id}/schedule`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ start_date: startDate, expected_end_date: endDate || null })
    });
    const result = (await response.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
    if (!response.ok || !result?.ok) {
      setError(result?.error || "Schedule could not be saved.");
      return;
    }
    setMessage("Schedule saved. Job moved to Booked where relevant.");
    startTransition(() => router.refresh());
  }

  if (!["Accepted", "Materials Needed", "Materials Ordered", "Booked", "Scaffold In Situ", "In Progress"].includes(job.status)) return null;

  return (
    <div className="card p-5">
      <p className="section-kicker text-[0.65rem] uppercase">Schedule Works</p>
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <label>
          <span className="label">Start Date</span>
          <input className="field min-h-11" min={new Date().toISOString().slice(0, 10)} onChange={(event) => setStartDate(event.target.value)} type="date" value={startDate} />
          <span className="mt-1 block text-xs text-[var(--muted)]">Can be updated any time. Roofing changes daily.</span>
        </label>
        <label>
          <span className="label">Expected Completion</span>
          <input className="field min-h-11" min={startDate || new Date().toISOString().slice(0, 10)} onChange={(event) => setEndDate(event.target.value)} type="date" value={endDate} />
        </label>
      </div>
      {startDate ? (
        <div className="mt-4 flex flex-wrap gap-3">
          <button className="button-primary" disabled={isPending} onClick={saveSchedule} type="button">
            {isPending ? "Saving..." : "Save Schedule"}
          </button>
          <a className="button-secondary" href={calendarLink} rel="noreferrer" target="_blank">
            Add to Google Calendar
          </a>
        </div>
      ) : null}
      {message ? <p className="mt-4 text-sm text-[#7ce3a6]">{message}</p> : null}
      {error ? <p className="mt-4 text-sm text-[#ff9a91]">{error}</p> : null}
    </div>
  );
}
