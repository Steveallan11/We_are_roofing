import Link from "next/link";
import type { Route } from "next";
import type { ActivityRecord, ActivityType } from "@/lib/activity/types";

type Props = {
  entries: ActivityRecord[];
  jobId: string;
  compact?: boolean;
  emptyMessage?: string;
};

export function ActivityTimeline({ entries, jobId, compact = false, emptyMessage = "No activity logged yet." }: Props) {
  const displayed = compact ? entries.slice(0, 5) : entries;

  if (displayed.length === 0) {
    return <p className="text-sm text-[var(--text-muted)]">{emptyMessage}</p>;
  }

  return (
    <ol className="relative space-y-3 border-l border-[var(--border)] pl-5">
      {displayed.map((entry) => (
        <ActivityRow key={entry.id} entry={entry} jobId={jobId} />
      ))}
    </ol>
  );
}

function ActivityRow({ entry, jobId }: { entry: ActivityRecord; jobId: string }) {
  const meta = activityMeta(entry.activity_type);
  const href = activityHref(entry, jobId);

  const body = (
    <div className="flex flex-col gap-1">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-sm font-medium text-[var(--text)]">{entry.message}</span>
        <span className="shrink-0 text-[10px] uppercase tracking-wider text-[var(--text-muted)]">{formatRelative(entry.created_at)}</span>
      </div>
      <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider text-[var(--text-muted)]">
        <span className={`rounded px-1.5 py-0.5 ${meta.badgeClass}`}>{meta.label}</span>
        {entry.actor_name ? <span>by {entry.actor_name}</span> : null}
      </div>
    </div>
  );

  return (
    <li className="relative">
      <span className={`absolute -left-[27px] top-1 grid h-3.5 w-3.5 place-items-center rounded-full ring-2 ring-[var(--ink)] ${meta.dotClass}`} aria-hidden />
      {href ? (
        <Link href={href as Route} className="block rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3 transition-colors hover:border-[var(--gold)]">
          {body}
        </Link>
      ) : (
        <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3">{body}</div>
      )}
    </li>
  );
}

function activityMeta(type: ActivityType): { label: string; dotClass: string; badgeClass: string } {
  switch (type) {
    case "job_created":
      return { label: "Created", dotClass: "bg-[var(--gold)]", badgeClass: "bg-[var(--gold)]/15 text-[var(--gold-l)]" };
    case "job_edited":
    case "quote_edited":
    case "survey_edited":
    case "materials_updated":
    case "note_added":
      return { label: "Edited", dotClass: "bg-[#94a3b8]", badgeClass: "bg-white/5 text-[var(--text-muted)]" };
    case "status_changed":
      return { label: "Status", dotClass: "bg-[#3b82f6]", badgeClass: "bg-[#3b82f6]/15 text-[#93c5fd]" };
    case "survey_booked":
    case "calendar_booked":
      return { label: "Booked", dotClass: "bg-[#3b82f6]", badgeClass: "bg-[#3b82f6]/15 text-[#93c5fd]" };
    case "survey_saved":
    case "takeoff_saved":
    case "photos_uploaded":
    case "drawing_generated":
    case "drawing_attached":
      return { label: "Survey", dotClass: "bg-[#10b981]", badgeClass: "bg-[#10b981]/15 text-[#6ee7b7]" };
    case "quote_generated":
    case "quote_approved":
      return { label: "Quote", dotClass: "bg-[var(--gold)]", badgeClass: "bg-[var(--gold)]/15 text-[var(--gold-l)]" };
    case "quote_sent":
    case "email_sent":
    case "sms_sent":
      return { label: "Sent", dotClass: "bg-[#10b981]", badgeClass: "bg-[#10b981]/15 text-[#6ee7b7]" };
    case "email_failed":
      return { label: "Failed", dotClass: "bg-[#ef4444]", badgeClass: "bg-[#ef4444]/15 text-[#fca5a5]" };
    case "quote_accepted":
    case "payment_received":
    case "job_completed":
      return { label: "Win", dotClass: "bg-[#10b981]", badgeClass: "bg-[#10b981]/20 text-[#6ee7b7]" };
    case "quote_declined":
      return { label: "Declined", dotClass: "bg-[#ef4444]", badgeClass: "bg-[#ef4444]/15 text-[#fca5a5]" };
    case "customer_replied":
    case "customer_message":
      return { label: "Customer", dotClass: "bg-[#3b82f6]", badgeClass: "bg-[#3b82f6]/15 text-[#93c5fd]" };
    case "invoice_created":
    case "invoice_sent":
      return { label: "Invoice", dotClass: "bg-[var(--gold)]", badgeClass: "bg-[var(--gold)]/15 text-[var(--gold-l)]" };
    case "job_rescheduled":
      return { label: "Moved", dotClass: "bg-[#f59e0b]", badgeClass: "bg-[#f59e0b]/15 text-[#fcd34d]" };
    default:
      return { label: "Event", dotClass: "bg-[var(--gold)]", badgeClass: "bg-white/5 text-[var(--text-muted)]" };
  }
}

function activityHref(entry: ActivityRecord, jobId: string): string | null {
  const linked = entry.linked_entity_type;
  if (linked === "quote") return `/jobs/${jobId}/quote`;
  if (linked === "survey") return `/jobs/${jobId}/survey`;
  if (linked === "invoice") return `/jobs/${jobId}`;
  if (linked === "comms_message" || linked === "email") return `/comms`;
  if (linked === "document") return `/jobs/${jobId}?tab=documents`;
  switch (entry.activity_type) {
    case "quote_generated":
    case "quote_edited":
    case "quote_approved":
    case "quote_sent":
    case "quote_accepted":
    case "quote_declined":
      return `/jobs/${jobId}/quote`;
    case "survey_saved":
    case "survey_edited":
    case "takeoff_saved":
    case "photos_uploaded":
      return `/jobs/${jobId}/survey`;
    case "materials_updated":
      return `/jobs/${jobId}/materials`;
    case "customer_replied":
    case "customer_message":
    case "email_sent":
      return `/comms`;
    default:
      return null;
  }
}

function formatRelative(iso: string): string {
  try {
    const then = new Date(iso).getTime();
    const now = Date.now();
    const diffMs = now - then;
    const minutes = Math.round(diffMs / 60000);
    if (minutes < 1) return "Just now";
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.round(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.round(hours / 24);
    if (days < 7) return `${days}d ago`;
    return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
  } catch {
    return "";
  }
}
