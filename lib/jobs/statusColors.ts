import type { JobStatus } from "@/lib/types";

export const STATUS_CONFIG: Record<
  JobStatus,
  {
    color: string;
    bg: string;
    border: string;
    label: string;
    column: "leads" | "survey" | "quoting" | "sent" | "active" | "done";
  }
> = {
  "New Lead": {
    color: "#3b82f6",
    bg: "rgba(59,130,246,0.10)",
    border: "rgba(59,130,246,0.25)",
    label: "New Lead",
    column: "leads"
  },
  "Survey Needed": {
    color: "#f59e0b",
    bg: "rgba(245,158,11,0.10)",
    border: "rgba(245,158,11,0.25)",
    label: "Survey",
    column: "survey"
  },
  "Survey Complete": {
    color: "#d97706",
    bg: "rgba(217,119,6,0.12)",
    border: "rgba(217,119,6,0.25)",
    label: "Survey Done",
    column: "survey"
  },
  "Ready For AI Quote": {
    color: "#D4AF37",
    bg: "rgba(212,175,55,0.10)",
    border: "rgba(212,175,55,0.25)",
    label: "AI Quote",
    column: "quoting"
  },
  "Quote Drafted": {
    color: "#D4AF37",
    bg: "rgba(212,175,55,0.10)",
    border: "rgba(212,175,55,0.25)",
    label: "Quoting",
    column: "quoting"
  },
  "Ready To Send": {
    color: "#b8960c",
    bg: "rgba(184,150,12,0.12)",
    border: "rgba(184,150,12,0.25)",
    label: "Ready",
    column: "quoting"
  },
  "Quote Sent": {
    color: "#8b5cf6",
    bg: "rgba(139,92,246,0.10)",
    border: "rgba(139,92,246,0.25)",
    label: "Sent",
    column: "sent"
  },
  "Follow-Up Needed": {
    color: "#ef4444",
    bg: "rgba(239,68,68,0.10)",
    border: "rgba(239,68,68,0.25)",
    label: "Follow Up",
    column: "sent"
  },
  Accepted: {
    color: "#10b981",
    bg: "rgba(16,185,129,0.10)",
    border: "rgba(16,185,129,0.25)",
    label: "Accepted",
    column: "active"
  },
  "Materials Needed": {
    color: "#059669",
    bg: "rgba(5,150,105,0.10)",
    border: "rgba(5,150,105,0.25)",
    label: "Materials",
    column: "active"
  },
  Booked: {
    color: "#047857",
    bg: "rgba(4,120,87,0.12)",
    border: "rgba(4,120,87,0.25)",
    label: "Booked",
    column: "active"
  },
  Completed: {
    color: "#64748b",
    bg: "rgba(100,116,139,0.10)",
    border: "rgba(100,116,139,0.25)",
    label: "Completed",
    column: "done"
  },
  Lost: {
    color: "#475569",
    bg: "rgba(71,85,105,0.10)",
    border: "rgba(71,85,105,0.20)",
    label: "Lost",
    column: "done"
  },
  Archived: {
    color: "#334155",
    bg: "rgba(51,65,85,0.08)",
    border: "rgba(51,65,85,0.18)",
    label: "Archived",
    column: "done"
  }
};

export const STATUS_COLORS: Record<JobStatus, { bg: string; text: string; dot: string }> = Object.fromEntries(
  Object.entries(STATUS_CONFIG).map(([status, config]) => [
    status,
    {
      bg: config.bg,
      text: config.color,
      dot: config.color
    }
  ])
) as Record<JobStatus, { bg: string; text: string; dot: string }>;

export function getStatusColor(status: JobStatus) {
  return STATUS_COLORS[status] ?? STATUS_COLORS.Archived;
}
