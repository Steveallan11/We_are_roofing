export const PIPELINE_COLUMNS = [
  {
    id: "leads",
    label: "Leads",
    color: "#3b82f6",
    icon: "users",
    statuses: ["New Lead"]
  },
  {
    id: "survey",
    label: "Survey",
    color: "#f59e0b",
    icon: "clipboard-list",
    statuses: ["Survey Needed", "Survey Complete"]
  },
  {
    id: "quoting",
    label: "Quoting",
    color: "#D4AF37",
    icon: "document-text",
    statuses: ["Ready For AI Quote", "Quote Drafted", "Ready To Send"]
  },
  {
    id: "sent",
    label: "Sent",
    color: "#8b5cf6",
    icon: "mail",
    statuses: ["Quote Sent", "Follow-Up Needed"]
  },
  {
    id: "active",
    label: "Active",
    color: "#10b981",
    icon: "calendar",
    statuses: ["Accepted", "Materials Needed", "Booked"]
  }
] as const;
