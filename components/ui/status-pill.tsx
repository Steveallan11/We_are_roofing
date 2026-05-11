import { cn } from "@/lib/utils";
import { getStatusDisplayLabel } from "@/lib/job-workflow";
import type { JobStatus, QuoteStatus } from "@/lib/types";

type Props = {
  status: JobStatus | QuoteStatus;
};

const statusStyles: Record<string, string> = {
  "New Lead": "border-[rgba(255,255,255,0.18)] bg-[rgba(255,255,255,0.06)] text-[var(--text)]",
  "Survey Needed": "border-[rgba(84,160,255,0.38)] bg-[rgba(84,160,255,0.12)] text-[#b7d2ff]",
  "Survey Complete": "border-[rgba(212,175,55,0.35)] bg-[rgba(212,175,55,0.12)] text-[var(--gold-l)]",
  "Ready For AI Quote": "border-[rgba(212,175,55,0.35)] bg-[rgba(212,175,55,0.12)] text-[var(--gold-l)]",
  "Quote Drafted": "border-[rgba(255,184,108,0.38)] bg-[rgba(255,184,108,0.12)] text-[#ffd38b]",
  "Ready To Send": "border-[rgba(245,208,96,0.4)] bg-[rgba(245,208,96,0.12)] text-[var(--gold-l)]",
  "Quote Sent": "border-[rgba(46,204,113,0.38)] bg-[rgba(46,204,113,0.12)] text-[#7ce3a6]",
  Accepted: "border-[rgba(59,130,246,0.35)] bg-[rgba(59,130,246,0.12)] text-[#9bc3ff]",
  Booked: "border-[rgba(155,89,182,0.35)] bg-[rgba(155,89,182,0.12)] text-[#d4b5ff]",
  Completed: "border-[rgba(46,204,113,0.38)] bg-[rgba(46,204,113,0.12)] text-[#7ce3a6]",
  "Follow-Up Needed": "border-[rgba(255,184,108,0.38)] bg-[rgba(255,184,108,0.12)] text-[#ffd38b]",
  "Materials Needed": "border-[rgba(84,160,255,0.38)] bg-[rgba(84,160,255,0.12)] text-[#b7d2ff]",
  Lost: "border-[rgba(231,76,60,0.35)] bg-[rgba(231,76,60,0.12)] text-[#ff9a91]",
  Archived: "border-[rgba(255,255,255,0.16)] bg-[rgba(255,255,255,0.05)] text-[var(--muted)]",
  Draft: "border-[rgba(212,175,55,0.3)] bg-[rgba(212,175,55,0.08)] text-[var(--text)]",
  Approved: "border-[rgba(46,204,113,0.38)] bg-[rgba(46,204,113,0.12)] text-[#7ce3a6]",
  Sent: "border-[rgba(46,204,113,0.38)] bg-[rgba(46,204,113,0.12)] text-[#7ce3a6]",
  "Needs Review": "border-[rgba(231,76,60,0.35)] bg-[rgba(231,76,60,0.12)] text-[#ff9a91]"
};

export function StatusPill({ status }: Props) {
  const label = typeof status === "string" ? getStatusDisplayLabel(status as JobStatus) : status;
  return <span className={cn("status-pill", statusStyles[status] ?? "surface-muted text-[var(--text)]")}>{label}</span>;
}
