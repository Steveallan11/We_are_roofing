"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { WeatherStrip } from "@/components/weather/WeatherStrip";
import { googleCalendarLink, icsDataUrl } from "@/lib/calendar/generateICS";
import type { JobBundle } from "@/lib/types";

export function BookSurveyForm({ bundle }: { bundle: JobBundle }) {
  const router = useRouter();
  const [date, setDate] = useState(bundle.job.survey_date ?? new Date().toISOString().slice(0, 10));
  const [timeStart, setTimeStart] = useState(bundle.job.survey_time?.slice(0, 5) ?? "09:00");
  const [duration, setDuration] = useState(Number(bundle.job.survey_duration ?? 60));
  const [address, setAddress] = useState(bundle.job.survey_address ?? bundle.job.property_address);
  const [notes, setNotes] = useState(bundle.job.survey_notes ?? "");
  const [sendEmail, setSendEmail] = useState(Boolean(bundle.customer.email));
  const [sendSms, setSendSms] = useState(Boolean(bundle.customer.phone));
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const calendarBooking = useMemo(
    () => ({
      title: bundle.job.job_title,
      date,
      timeStart,
      duration,
      address,
      notes,
      jobRef: bundle.job.job_ref ?? "WR-J-TBC"
    }),
    [address, bundle.job.job_ref, bundle.job.job_title, date, duration, notes, timeStart]
  );

  async function submit() {
    setError(null);
    setSuccess(null);
    const response = await fetch(`/api/jobs/${bundle.job.id}/book-survey`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        date,
        time_start: timeStart,
        duration_mins: duration,
        address,
        notes,
        send_email: sendEmail,
        send_sms: sendSms
      })
    });
    const result = (await response.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
    if (!response.ok || !result?.ok) {
      setError(result?.error || "Survey booking could not be saved.");
      return;
    }
    setSuccess("Survey booked and customer notifications logged.");
    startTransition(() => router.push(`/jobs/${bundle.job.id}`));
  }

  return (
    <div className="stack">
      <div className="card p-5">
        <p className="section-kicker text-[0.65rem] uppercase">7 Day Forecast</p>
        <div className="mt-4">
          <WeatherStrip location={bundle.business.weather_location ?? bundle.customer.town ?? "Yateley"} />
        </div>
      </div>

      <div className="card overflow-hidden">
        <div className="border-b border-[var(--border)] bg-black/20 p-5">
          <p className="section-kicker text-[0.65rem] uppercase">{bundle.job.job_ref ?? "WR-J-TBC"}</p>
          <h2 className="mt-2 font-display text-4xl text-white">Book Survey</h2>
          <p className="mt-2 text-sm text-[var(--muted)]">{bundle.customer.full_name} · {bundle.job.property_address}</p>
        </div>
        <div className="grid gap-4 p-5 md:grid-cols-2">
          <label>
            <span className="label">Date</span>
            <input className="field min-h-11" onChange={(event) => setDate(event.target.value)} type="date" value={date} />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label>
              <span className="label">Time</span>
              <input className="field min-h-11" onChange={(event) => setTimeStart(event.target.value)} type="time" value={timeStart} />
            </label>
            <label>
              <span className="label">Duration</span>
              <select className="field min-h-11" onChange={(event) => setDuration(Number(event.target.value))} value={duration}>
                <option value={30}>30 minutes</option>
                <option value={60}>1 hour</option>
                <option value={90}>1.5 hours</option>
                <option value={120}>2 hours</option>
              </select>
            </label>
          </div>
          <label className="md:col-span-2">
            <span className="label">Survey address</span>
            <input className="field min-h-11" onChange={(event) => setAddress(event.target.value)} value={address} />
          </label>
          <label className="md:col-span-2">
            <span className="label">Access notes</span>
            <textarea className="field min-h-28" onChange={(event) => setNotes(event.target.value)} placeholder="Side gate, parking, access restrictions..." value={notes} />
          </label>
        </div>
        <div className="border-t border-[var(--border)] p-5">
          <p className="section-kicker text-[0.65rem] uppercase">Notify Customer</p>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            <label className="flex items-center gap-3 rounded-2xl border border-[var(--border)] bg-black/20 p-4 text-sm text-[var(--text)]">
              <input checked={sendEmail} disabled={!bundle.customer.email} onChange={(event) => setSendEmail(event.target.checked)} type="checkbox" />
              Send confirmation email {bundle.customer.email ? "" : "(no email saved)"}
            </label>
            <label className="flex items-center gap-3 rounded-2xl border border-[var(--border)] bg-black/20 p-4 text-sm text-[var(--text)]">
              <input checked={sendSms} disabled={!bundle.customer.phone} onChange={(event) => setSendSms(event.target.checked)} type="checkbox" />
              Send confirmation SMS {bundle.customer.phone ? "" : "(no phone saved)"}
            </label>
          </div>
          <div className="mt-5 flex flex-wrap gap-3">
            <a className="button-secondary" download={`survey-${bundle.job.job_ref ?? bundle.job.id}.ics`} href={icsDataUrl(calendarBooking)}>
              Apple / Outlook Calendar
            </a>
            <a className="button-secondary" href={googleCalendarLink(calendarBooking)} rel="noreferrer" target="_blank">
              Google Calendar
            </a>
            <button className="button-primary" disabled={isPending} onClick={submit} type="button">
              {isPending ? "Booking..." : "Confirm Booking"}
            </button>
          </div>
          {error ? <p className="mt-4 text-sm text-[#ff9a91]">{error}</p> : null}
          {success ? <p className="mt-4 text-sm text-[#7ce3a6]">{success}</p> : null}
        </div>
      </div>
    </div>
  );
}
