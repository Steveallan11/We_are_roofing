"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button, Card, Input, Select, Textarea, CardHeader, CardTitle, CardKicker, CardBody } from "@/components/ui/primitives";
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
      <Card>
        <CardHeader>
          <div>
            <CardKicker>7 Day Forecast</CardKicker>
          </div>
        </CardHeader>
        <CardBody>
          <WeatherStrip location={bundle.business.weather_location ?? bundle.customer.town ?? "Yateley"} />
        </CardBody>
      </Card>

      <Card>
        <CardHeader className="flex-col items-start gap-1 border-b border-[var(--border)] bg-black/20 p-5">
          <CardKicker>{bundle.job.job_ref ?? "WR-J-TBC"}</CardKicker>
          <CardTitle className="mt-2 !text-4xl">Book Survey</CardTitle>
          <p className="mt-2 text-sm text-[var(--muted)]">{bundle.customer.full_name} · {bundle.job.property_address}</p>
        </CardHeader>
        <CardBody className="grid gap-4 md:grid-cols-2">
          <Input
            label="Date"
            onChange={(e) => setDate(e.target.value)}
            type="date"
            value={date}
          />
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Time"
              onChange={(e) => setTimeStart(e.target.value)}
              type="time"
              value={timeStart}
            />
            <Select
              label="Duration"
              onChange={(e) => setDuration(Number(e.target.value))}
              value={duration.toString()}
            >
              <option value={30}>30 minutes</option>
              <option value={60}>1 hour</option>
              <option value={90}>1.5 hours</option>
              <option value={120}>2 hours</option>
            </Select>
          </div>
          <Input
            label="Survey address"
            onChange={(e) => setAddress(e.target.value)}
            value={address}
            className="md:col-span-2"
          />
          <Textarea
            label="Access notes"
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Side gate, parking, access restrictions..."
            value={notes}
            className="md:col-span-2"
            rows={4}
          />
        </CardBody>
        <div className="border-t border-[var(--border)] p-5">
          <p className="text-xs font-bold uppercase tracking-wider text-[var(--dim)]">Notify Customer</p>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            <label className="flex items-center gap-3 rounded-lg border border-[var(--border)] bg-black/20 p-4 text-sm text-[var(--text)] cursor-pointer">
              <input checked={sendEmail} disabled={!bundle.customer.email} onChange={(e) => setSendEmail(e.target.checked)} type="checkbox" />
              Send confirmation email {bundle.customer.email ? "" : "(no email saved)"}
            </label>
            <label className="flex items-center gap-3 rounded-lg border border-[var(--border)] bg-black/20 p-4 text-sm text-[var(--text)] cursor-pointer">
              <input checked={sendSms} disabled={!bundle.customer.phone} onChange={(e) => setSendSms(e.target.checked)} type="checkbox" />
              Send confirmation SMS {bundle.customer.phone ? "" : "(no phone saved)"}
            </label>
          </div>
          <div className="mt-5 flex flex-wrap gap-3">
            <Button variant="secondary" asChild>
              <a download={`survey-${bundle.job.job_ref ?? bundle.job.id}.ics`} href={icsDataUrl(calendarBooking)}>
                Apple / Outlook Calendar
              </a>
            </Button>
            <Button variant="secondary" asChild>
              <a href={googleCalendarLink(calendarBooking)} rel="noreferrer" target="_blank">
                Google Calendar
              </a>
            </Button>
            <Button variant="primary" disabled={isPending} onClick={submit}>
              {isPending ? "Booking..." : "Confirm Booking"}
            </Button>
          </div>
          {error ? <p className="mt-4 text-sm text-[#ff9a91]">{error}</p> : null}
          {success ? <p className="mt-4 text-sm text-[#7ce3a6]">{success}</p> : null}
        </div>
      </Card>
    </div>
  );
}
