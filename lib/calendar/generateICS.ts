export type CalendarBooking = {
  title: string;
  date: string;
  timeStart: string;
  duration: number;
  address: string;
  notes?: string;
  jobRef: string;
  calendarTitle?: string;
};

function pad(value: number) {
  return String(value).padStart(2, "0");
}

function dateParts(date: string, time: string, addMinutes = 0) {
  const [year, month, day] = date.split("-").map(Number);
  const [hour, minute] = time.split(":").map(Number);
  const value = new Date(year, month - 1, day, hour, minute + addMinutes, 0);
  return {
    year: value.getFullYear(),
    month: value.getMonth() + 1,
    day: value.getDate(),
    hour: value.getHours(),
    minute: value.getMinutes()
  };
}

function formatICSDate(date: string, time: string, addMinutes = 0) {
  const parts = dateParts(date, time, addMinutes);
  return `${parts.year}${pad(parts.month)}${pad(parts.day)}T${pad(parts.hour)}${pad(parts.minute)}00`;
}

function formatGCal(date: string, time: string, addMinutes = 0) {
  const parts = dateParts(date, time, addMinutes);
  return `${parts.year}${pad(parts.month)}${pad(parts.day)}T${pad(parts.hour)}${pad(parts.minute)}00`;
}

function escapeICS(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/,/g, "\\,").replace(/;/g, "\\;");
}

export function generateICS(booking: CalendarBooking): string {
  const start = formatICSDate(booking.date, booking.timeStart);
  const end = formatICSDate(booking.date, booking.timeStart, booking.duration);
  const title = booking.calendarTitle || `Roof Survey - ${booking.title}`;
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//We Are Roofing UK Ltd//Booking//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${booking.jobRef}-booking@weareroofing.co.uk`,
    `DTSTART:${start}`,
    `DTEND:${end}`,
    `SUMMARY:${escapeICS(title)}`,
    `LOCATION:${escapeICS(booking.address)}`,
    `DESCRIPTION:${escapeICS(`Job ${booking.jobRef}\n${booking.notes || ""}`)}`,
    "END:VEVENT",
    "END:VCALENDAR"
  ].join("\r\n");
}

export function googleCalendarLink(booking: CalendarBooking): string {
  const base = "https://calendar.google.com/calendar/render?action=TEMPLATE";
  const dates = `${formatGCal(booking.date, booking.timeStart)}/${formatGCal(booking.date, booking.timeStart, booking.duration)}`;
  const title = booking.calendarTitle || `Roof Survey - ${booking.title}`;
  return `${base}&text=${encodeURIComponent(title)}&dates=${dates}&location=${encodeURIComponent(booking.address)}&details=${encodeURIComponent(`Job ${booking.jobRef}\n${booking.notes || ""}`)}`;
}

export function icsDataUrl(booking: CalendarBooking) {
  return `data:text/calendar;charset=utf-8,${encodeURIComponent(generateICS(booking))}`;
}
