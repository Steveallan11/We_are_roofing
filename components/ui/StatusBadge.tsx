import { getStatusDisplayLabel } from "@/lib/job-workflow";
import { getStatusColor } from "@/lib/jobs/statusColors";
import type { JobStatus, QuoteStatus } from "@/lib/types";

type Props = {
  status: JobStatus | QuoteStatus;
};

const quoteStyles: Record<string, { bg: string; text: string; dot: string }> = {
  Draft: { bg: "rgba(212,175,55,0.08)", text: "#f0e8d0", dot: "#D4AF37" },
  Approved: { bg: "rgba(16,185,129,0.1)", text: "#10b981", dot: "#10b981" },
  Sent: { bg: "rgba(139,92,246,0.1)", text: "#8b5cf6", dot: "#8b5cf6" },
  "Needs Review": { bg: "rgba(239,68,68,0.1)", text: "#ef4444", dot: "#ef4444" },
  Accepted: { bg: "rgba(16,185,129,0.1)", text: "#10b981", dot: "#10b981" },
  Declined: { bg: "rgba(100,116,139,0.1)", text: "#64748b", dot: "#64748b" }
};

export function StatusBadge({ status }: Props) {
  const colors = quoteStyles[status] ?? getStatusColor(status as JobStatus);
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold"
      style={{ background: colors.bg, borderColor: colors.dot, color: colors.text }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: colors.dot }} />
      {getStatusDisplayLabel(status as JobStatus)}
    </span>
  );
}
