/* Stage-based status colors for visual hierarchy
 * Red/Alert: Needs immediate attention, follow-ups
 * Orange/Pending: Awaiting action, review, survey
 * Gold/Ready: Prepared and ready to move
 * Green/Active: In progress or accepted
 * Slate/Complete: Done or archived
 */
export const STATUS_COLORS = {
  "New Lead": { color: "#3b82f6", bg: "rgba(59,130,246,0.10)", border: "rgba(59,130,246,0.20)", label: "New Lead", dot: "#3b82f6", stage: "pending" },
  "Survey Needed": { color: "#f59e0b", bg: "rgba(245,158,11,0.10)", border: "rgba(245,158,11,0.20)", label: "Survey", dot: "#f59e0b", stage: "pending" },
  "Survey Complete": { color: "#d97706", bg: "rgba(217,119,6,0.10)", border: "rgba(217,119,6,0.20)", label: "Survey Done", dot: "#d97706", stage: "pending" },
  "Ready For AI Quote": { color: "#D4AF37", bg: "rgba(212,175,55,0.10)", border: "rgba(212,175,55,0.20)", label: "AI Quote", dot: "#D4AF37", stage: "ready" },
  "Quote Drafted": { color: "#D4AF37", bg: "rgba(212,175,55,0.10)", border: "rgba(212,175,55,0.20)", label: "Quoting", dot: "#D4AF37", stage: "ready" },
  "Ready To Send": { color: "#b8960c", bg: "rgba(184,150,12,0.10)", border: "rgba(184,150,12,0.20)", label: "Ready", dot: "#b8960c", stage: "ready" },
  "Quote Sent": { color: "#8b5cf6", bg: "rgba(139,92,246,0.10)", border: "rgba(139,92,246,0.20)", label: "Sent", dot: "#8b5cf6", stage: "pending" },
  "Follow-Up Needed": { color: "#ef4444", bg: "rgba(239,68,68,0.10)", border: "rgba(239,68,68,0.20)", label: "Follow Up", dot: "#ef4444", stage: "alert" },
  Accepted: { color: "#10b981", bg: "rgba(16,185,129,0.10)", border: "rgba(16,185,129,0.20)", label: "Accepted", dot: "#10b981", stage: "active" },
  "Materials Needed": { color: "#059669", bg: "rgba(5,150,105,0.10)", border: "rgba(5,150,105,0.20)", label: "Materials", dot: "#059669", stage: "active" },
  "Materials Ordered": { color: "#0d9488", bg: "rgba(13,148,136,0.10)", border: "rgba(13,148,136,0.20)", label: "Materials Ordered", dot: "#0d9488", stage: "active" },
  "Scaffold In Situ": { color: "#06b6d4", bg: "rgba(6,182,212,0.10)", border: "rgba(6,182,212,0.20)", label: "Scaffold Ready", dot: "#06b6d4", stage: "active" },
  Booked: { color: "#047857", bg: "rgba(4,120,87,0.10)", border: "rgba(4,120,87,0.20)", label: "Booked", dot: "#047857", stage: "active" },
  "In Progress": { color: "#22c55e", bg: "rgba(34,197,94,0.10)", border: "rgba(34,197,94,0.20)", label: "In Progress", dot: "#22c55e", stage: "active" },
  Completed: { color: "#64748b", bg: "rgba(100,116,139,0.10)", border: "rgba(100,116,139,0.20)", label: "Completed", dot: "#64748b", stage: "complete" },
  "Not Proceeding": { color: "#475569", bg: "rgba(71,85,105,0.08)", border: "rgba(71,85,105,0.18)", label: "Not Proceeding", dot: "#475569", stage: "complete" },
  Lost: { color: "#475569", bg: "rgba(71,85,105,0.08)", border: "rgba(71,85,105,0.18)", label: "Lost", dot: "#475569", stage: "complete" },
  Archived: { color: "#334155", bg: "rgba(51,65,85,0.06)", border: "rgba(51,65,85,0.15)", label: "Archived", dot: "#334155", stage: "complete" }
} as const;

export const QUOTE_STATUS_COLORS = {
  Draft: { color: "#64748b", bg: "rgba(100,116,139,0.10)", border: "rgba(100,116,139,0.20)", label: "Draft" },
  "Needs Review": { color: "#f59e0b", bg: "rgba(245,158,11,0.10)", border: "rgba(245,158,11,0.20)", label: "Review" },
  Approved: { color: "#D4AF37", bg: "rgba(212,175,55,0.10)", border: "rgba(212,175,55,0.20)", label: "Approved" },
  Sent: { color: "#8b5cf6", bg: "rgba(139,92,246,0.10)", border: "rgba(139,92,246,0.20)", label: "Sent" },
  Accepted: { color: "#10b981", bg: "rgba(16,185,129,0.10)", border: "rgba(16,185,129,0.20)", label: "Accepted" },
  Declined: { color: "#ef4444", bg: "rgba(239,68,68,0.10)", border: "rgba(239,68,68,0.20)", label: "Declined" }
} as const;

export const INVOICE_STATUS_COLORS = {
  Draft: { color: "#64748b", bg: "rgba(100,116,139,0.10)", border: "rgba(100,116,139,0.20)", label: "Draft" },
  Sent: { color: "#f59e0b", bg: "rgba(245,158,11,0.10)", border: "rgba(245,158,11,0.20)", label: "Sent" },
  Outstanding: { color: "#f59e0b", bg: "rgba(245,158,11,0.10)", border: "rgba(245,158,11,0.20)", label: "Outstanding" },
  "Part Paid": { color: "#3b82f6", bg: "rgba(59,130,246,0.10)", border: "rgba(59,130,246,0.20)", label: "Part Paid" },
  Overdue: { color: "#ef4444", bg: "rgba(239,68,68,0.10)", border: "rgba(239,68,68,0.20)", label: "Overdue" },
  Paid: { color: "#10b981", bg: "rgba(16,185,129,0.10)", border: "rgba(16,185,129,0.20)", label: "Paid" },
  Cancelled: { color: "#64748b", bg: "rgba(100,116,139,0.08)", border: "rgba(100,116,139,0.18)", label: "Cancelled" },
  Void: { color: "#64748b", bg: "rgba(100,116,139,0.08)", border: "rgba(100,116,139,0.18)", label: "Void" }
} as const;

export const CONDITION_COLORS = {
  Good: { color: "#10b981", bg: "rgba(16,185,129,0.10)", border: "rgba(16,185,129,0.20)", label: "Good" },
  Fair: { color: "#f59e0b", bg: "rgba(245,158,11,0.10)", border: "rgba(245,158,11,0.20)", label: "Fair" },
  Poor: { color: "#f97316", bg: "rgba(249,115,22,0.10)", border: "rgba(249,115,22,0.20)", label: "Poor" },
  Critical: { color: "#ef4444", bg: "rgba(239,68,68,0.10)", border: "rgba(239,68,68,0.20)", label: "Critical" }
} as const;

export const URGENCY_COLORS = {
  Low: { color: "#64748b", bg: "rgba(100,116,139,0.08)", border: "rgba(100,116,139,0.18)", label: "Low" },
  Medium: { color: "#f59e0b", bg: "rgba(245,158,11,0.10)", border: "rgba(245,158,11,0.20)", label: "Medium" },
  High: { color: "#f97316", bg: "rgba(249,115,22,0.10)", border: "rgba(249,115,22,0.20)", label: "High" },
  Emergency: { color: "#ef4444", bg: "rgba(239,68,68,0.10)", border: "rgba(239,68,68,0.20)", label: "Emergency" }
} as const;

export const KB_CATEGORY_COLORS = {
  "Historical Quote": "#D4AF37",
  "Pricing Reference": "#10b981",
  "Roof Report Style": "#3b82f6",
  "Quote Template": "#8b5cf6",
  Terms: "#64748b",
  "Supplier Info": "#f59e0b",
  "Materials System": "#f97316",
  "Scope Of Works": "#06b6d4"
} as const;
