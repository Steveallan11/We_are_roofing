import type { JobStatus } from "@/lib/types";
import { STATUS_COLORS as THEME_STATUS_COLORS } from "@/lib/theme/statusColors";

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
  "Materials Ordered": {
    color: "#0d9488",
    bg: "rgba(13,148,136,0.10)",
    border: "rgba(13,148,136,0.25)",
    label: "Materials Ordered",
    column: "active"
  },
  "Scaffold In Situ": {
    color: "#06b6d4",
    bg: "rgba(6,182,212,0.10)",
    border: "rgba(6,182,212,0.25)",
    label: "Scaffold Ready",
    column: "active"
  },
  Booked: {
    color: "#047857",
    bg: "rgba(4,120,87,0.12)",
    border: "rgba(4,120,87,0.25)",
    label: "Booked",
    column: "active"
  },
  "In Progress": {
    color: "#22c55e",
    bg: "rgba(34,197,94,0.10)",
    border: "rgba(34,197,94,0.25)",
    label: "In Progress",
    column: "active"
  },
  Completed: {
    color: "#64748b",
    bg: "rgba(100,116,139,0.10)",
    border: "rgba(100,116,139,0.25)",
    label: "Completed",
    column: "done"
  },
  "Not Proceeding": {
    color: "#475569",
    bg: "rgba(71,85,105,0.10)",
    border: "rgba(71,85,105,0.20)",
    label: "Not Proceeding",
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
  Object.entries(THEME_STATUS_COLORS).map(([status, config]) => [
    status,
    {
      bg: config.bg,
      text: config.color,
      dot: config.dot
    }
  ])
) as Record<JobStatus, { bg: string; text: string; dot: string }>;

export function getStatusColor(status: JobStatus) {
  return STATUS_COLORS[status] ?? STATUS_COLORS.Archived;
}

type Stage = "alert" | "pending" | "ready" | "active" | "complete";

export function getStageColor(stage: Stage): { bg: string; border: string; text: string } {
  switch (stage) {
    case "alert":
      return { bg: "var(--stage-alert-bg)", border: "var(--stage-alert-border)", text: "var(--stage-alert-text)" };
    case "pending":
      return { bg: "var(--stage-pending-bg)", border: "var(--stage-pending-border)", text: "var(--stage-pending-text)" };
    case "ready":
      return { bg: "var(--stage-ready-bg)", border: "var(--stage-ready-border)", text: "var(--stage-ready-text)" };
    case "active":
      return { bg: "var(--stage-active-bg)", border: "var(--stage-active-border)", text: "var(--stage-active-text)" };
    case "complete":
      return { bg: "var(--stage-complete-bg)", border: "var(--stage-complete-border)", text: "var(--stage-complete-text)" };
  }
}

export function getJobStage(status: JobStatus): Stage {
  const config = STATUS_CONFIG[status];
  if (!config) return "complete";

  const themeColor = THEME_STATUS_COLORS[status];
  if (!themeColor) return "complete";

  return (themeColor as any).stage ?? "complete";
}
