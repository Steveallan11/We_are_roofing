import type { Customer, Job, QuoteRecord } from "@/lib/types";

export type JobForAction = Job & {
  customer?: Customer | null;
  quote?: QuoteRecord | null;
};

export type JobAction = {
  label: string;
  href: string;
  kind: "primary" | "secondary";
};

export function isPastDate(value?: string | null) {
  if (!value) return false;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  date.setHours(0, 0, 0, 0);
  return date < today;
}

export function isToday(value?: string | null) {
  if (!value) return false;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return false;
  const today = new Date();
  return date.toDateString() === today.toDateString();
}

export function daysSince(value?: string | null) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return Math.max(0, Math.floor((Date.now() - date.getTime()) / 86_400_000));
}

export function needsAttention(job: JobForAction) {
  const sentDays = daysSince(job.quote_sent_at);
  return (
    (isPastDate(job.follow_up_date) && !["Completed", "Lost", "Archived"].includes(job.status)) ||
    job.status === "Ready To Send" ||
    (job.status === "Quote Sent" && sentDays != null && sentDays >= 7) ||
    isToday(job.survey_date)
  );
}

export function getAttentionReason(job: JobForAction) {
  const sentDays = daysSince(job.quote_sent_at);
  if (isPastDate(job.follow_up_date)) return "Follow-up overdue";
  if (job.status === "Ready To Send") return "Quote ready to send";
  if (job.status === "Quote Sent" && sentDays != null && sentDays >= 7) return `Quote sent ${sentDays} days ago`;
  if (isToday(job.survey_date)) return "Survey booked today";
  return "Needs review";
}

export function getNextAction(job: JobForAction): JobAction {
  if (job.status === "New Lead") return { label: "Book Survey", href: `/jobs/${job.id}/survey`, kind: "primary" };
  if (job.status === "Survey Needed" && isPastDate(job.follow_up_date)) return { label: "Chase Up", href: `tel:${job.customer?.phone ?? ""}`, kind: "primary" };
  if (job.status === "Survey Needed") return { label: "Book Survey", href: `/jobs/${job.id}/survey`, kind: "primary" };
  if (job.status === "Survey Complete") return { label: "Generate Quote", href: `/jobs/${job.id}/survey`, kind: "primary" };
  if (job.status === "Ready For AI Quote") return { label: "Generate Quote", href: `/jobs/${job.id}/survey`, kind: "primary" };
  if (job.status === "Quote Drafted") return { label: "Review Quote", href: `/jobs/${job.id}/quote`, kind: "primary" };
  if (job.status === "Ready To Send") return { label: "Send Quote", href: `/jobs/${job.id}/quote`, kind: "primary" };
  if (job.status === "Quote Sent") return { label: "Chase Up", href: `tel:${job.customer?.phone ?? ""}`, kind: "primary" };
  if (job.status === "Follow-Up Needed") return { label: "Follow Up", href: `tel:${job.customer?.phone ?? ""}`, kind: "primary" };
  if (job.status === "Accepted") return { label: "Book In", href: `/jobs/${job.id}`, kind: "primary" };
  if (job.status === "Materials Needed") return { label: "Order Materials", href: `/jobs/${job.id}/materials`, kind: "primary" };
  if (job.status === "Booked") return { label: "View Job Sheet", href: `/jobs/${job.id}`, kind: "primary" };
  if (job.status === "Completed") return { label: "Create Invoice", href: `/jobs/${job.id}`, kind: "primary" };
  return { label: "Open Job", href: `/jobs/${job.id}`, kind: "primary" };
}

export function getSecondaryAction(job: JobForAction): JobAction {
  if (job.status === "New Lead" || job.status === "Survey Needed") return { label: "Call Customer", href: `tel:${job.customer?.phone ?? ""}`, kind: "secondary" };
  if (job.status === "Survey Complete") return { label: "View Survey", href: `/jobs/${job.id}/survey`, kind: "secondary" };
  if (job.status === "Quote Drafted" || job.status === "Ready To Send") return { label: "Preview Quote", href: `/jobs/${job.id}/quote`, kind: "secondary" };
  if (job.status === "Quote Sent") return { label: "View Quote", href: `/jobs/${job.id}/quote`, kind: "secondary" };
  if (job.status === "Booked") return { label: "Check Materials", href: `/jobs/${job.id}/materials`, kind: "secondary" };
  return { label: "Open Job", href: `/jobs/${job.id}`, kind: "secondary" };
}

export function getContextDateLabel(job: JobForAction) {
  const sentDays = daysSince(job.quote_sent_at);
  if (isToday(job.survey_date)) return "Survey today";
  if (job.survey_date) return `Survey ${formatDate(job.survey_date)}`;
  if (sentDays != null) return `Sent ${sentDays} day${sentDays === 1 ? "" : "s"} ago`;
  if (job.follow_up_date) return `Follow-up ${formatDate(job.follow_up_date)}`;
  if (job.created_at) return `Created ${formatDate(job.created_at)}`;
  return "No date set";
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-GB", { dateStyle: "medium" }).format(new Date(value));
}
