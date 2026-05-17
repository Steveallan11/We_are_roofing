import type { JobStatus } from "@/lib/types";

export const STATUS_COLORS: Record<JobStatus, { bg: string; text: string; dot: string }> = {
  "New Lead": { bg: "rgba(59,130,246,0.1)", text: "#3b82f6", dot: "#3b82f6" },
  "Survey Needed": { bg: "rgba(245,158,11,0.1)", text: "#f59e0b", dot: "#f59e0b" },
  "Survey Complete": { bg: "rgba(245,158,11,0.15)", text: "#d97706", dot: "#d97706" },
  "Ready For AI Quote": { bg: "rgba(212,175,55,0.1)", text: "#D4AF37", dot: "#D4AF37" },
  "Quote Drafted": { bg: "rgba(212,175,55,0.1)", text: "#D4AF37", dot: "#D4AF37" },
  "Ready To Send": { bg: "rgba(212,175,55,0.15)", text: "#b8960c", dot: "#b8960c" },
  "Quote Sent": { bg: "rgba(139,92,246,0.1)", text: "#8b5cf6", dot: "#8b5cf6" },
  "Follow-Up Needed": { bg: "rgba(239,68,68,0.1)", text: "#ef4444", dot: "#ef4444" },
  Accepted: { bg: "rgba(16,185,129,0.1)", text: "#10b981", dot: "#10b981" },
  "Materials Needed": { bg: "rgba(16,185,129,0.1)", text: "#059669", dot: "#059669" },
  Booked: { bg: "rgba(16,185,129,0.15)", text: "#047857", dot: "#047857" },
  Completed: { bg: "rgba(100,116,139,0.1)", text: "#64748b", dot: "#64748b" },
  Lost: { bg: "rgba(100,116,139,0.1)", text: "#475569", dot: "#475569" },
  Archived: { bg: "rgba(100,116,139,0.08)", text: "#334155", dot: "#334155" }
};

export function getStatusColor(status: JobStatus) {
  return STATUS_COLORS[status] ?? STATUS_COLORS.Archived;
}
