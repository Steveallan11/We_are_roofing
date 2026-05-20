import type { JobStatus } from "@/lib/types";

export type PipelineGroupKey = "all" | "new" | "survey" | "quoting" | "sent" | "booked" | "materials" | "in_progress" | "completed";

export type PipelineGroup = {
  key: PipelineGroupKey;
  label: string;
  shortLabel: string;
  statuses: JobStatus[];
  dropStatus: JobStatus;
};

export const PIPELINE_GROUPS: PipelineGroup[] = [
  {
    key: "new",
    label: "New Leads",
    shortLabel: "New Leads",
    statuses: ["New Lead"],
    dropStatus: "New Lead"
  },
  {
    key: "survey",
    label: "Survey",
    shortLabel: "Survey",
    statuses: ["Survey Needed", "Survey Complete"],
    dropStatus: "Survey Needed"
  },
  {
    key: "quoting",
    label: "Quoting",
    shortLabel: "Quoting",
    statuses: ["Ready For AI Quote", "Quote Drafted", "Ready To Send"],
    dropStatus: "Ready For AI Quote"
  },
  {
    key: "sent",
    label: "Sent",
    shortLabel: "Sent",
    statuses: ["Quote Sent", "Follow-Up Needed"],
    dropStatus: "Quote Sent"
  },
  {
    key: "booked",
    label: "Booked",
    shortLabel: "Booked",
    statuses: ["Accepted", "Booked", "Scaffold In Situ"],
    dropStatus: "Booked"
  },
  {
    key: "materials",
    label: "Materials",
    shortLabel: "Materials",
    statuses: ["Materials Needed", "Materials Ordered"],
    dropStatus: "Materials Ordered"
  },
  {
    key: "in_progress",
    label: "In Progress",
    shortLabel: "Active",
    statuses: ["In Progress"],
    dropStatus: "In Progress"
  },
  {
    key: "completed",
    label: "Completed",
    shortLabel: "Done",
    statuses: ["Completed"],
    dropStatus: "Completed"
  }
];

export function getPipelineGroup(key: PipelineGroupKey) {
  return PIPELINE_GROUPS.find((group) => group.key === key) ?? null;
}
