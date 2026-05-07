import { cn } from "@/lib/utils";
import type { JobStatus, QuoteStatus } from "@/lib/types";

type Props = {
  status: JobStatus | QuoteStatus;
};

const statusStyles: Record<string, string> = {
  "Ready For AI Quote": "border-[rgba(212,175,55,0.35)] bg-[rgba(212,175,55,0.12)] text-[var(--gold-l)]",
  "Ready To Send": "border-[rgba(245,208,96,0.4)] bg-[rgba(245,208,96,0.12)] text-[var(--gold-l)]",
  "Quote Sent": "border-[rgba(46,204,113,0.38)] bg-[rgba(46,204,113,0.12)] text-[#7ce3a6]",
  Draft: "border-[rgba(212,175,55,0.3)] bg-[rgba(212,175,55,0.08)] text-[var(--text)]",
  Approved: "border-[rgba(46,204,113,0.38)] bg-[rgba(46,204,113,0.12)] text-[#7ce3a6]",
  Sent: "border-[rgba(46,204,113,0.38)] bg-[rgba(46,204,113,0.12)] text-[#7ce3a6]",
  "Needs Review": "border-[rgba(231,76,60,0.35)] bg-[rgba(231,76,60,0.12)] text-[#ff9a91]"
};

export function StatusPill({ status }: Props) {
  return <span className={cn("status-pill", statusStyles[status] ?? "surface-muted text-[var(--text)]")}>{status}</span>;
}

