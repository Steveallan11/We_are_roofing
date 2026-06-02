import type { JobStatus } from "@/lib/types";

export type PipelineGroupKey = "all" | "new" | "survey" | "quoting" | "sent" | "booked" | "materials" | "in_progress" | "completed";

export type PipelineStage = "alert" | "pending" | "ready" | "active" | "complete";

export type PipelineGroup = {
  key: PipelineGroupKey;
  label: string;
  shortLabel: string;
  statuses: JobStatus[];
  dropStatus: JobStatus;
  stage: PipelineStage;
};

export const PIPELINE_GROUPS: PipelineGroup[] = [
  {
    key: "new",
    label: "New Leads",
    shortLabel: "New Leads",
    statuses: ["New Lead"],
    dropStatus: "New Lead",
    stage: "pending"
  },
  {
    key: "survey",
    label: "Survey",
    shortLabel: "Survey",
    statuses: ["Survey Needed", "Survey Complete"],
    dropStatus: "Survey Needed",
    stage: "pending"
  },
  {
    key: "quoting",
    label: "Quoting",
    shortLabel: "Quoting",
    statuses: ["Ready For AI Quote", "Quote Drafted", "Ready To Send"],
    dropStatus: "Ready For AI Quote",
    stage: "ready"
  },
  {
    key: "sent",
    label: "Sent",
    shortLabel: "Sent",
    statuses: ["Quote Sent", "Follow-Up Needed"],
    dropStatus: "Quote Sent",
    stage: "pending"
  },
  {
    key: "booked",
    label: "Booked",
    shortLabel: "Booked",
    statuses: ["Accepted", "Booked", "Scaffold In Situ"],
    dropStatus: "Booked",
    stage: "active"
  },
  {
    key: "materials",
    label: "Materials",
    shortLabel: "Materials",
    statuses: ["Materials Needed", "Materials Ordered"],
    dropStatus: "Materials Ordered",
    stage: "active"
  },
  {
    key: "in_progress",
    label: "In Progress",
    shortLabel: "Active",
    statuses: ["In Progress"],
    dropStatus: "In Progress",
    stage: "active"
  },
  {
    key: "completed",
    label: "Completed",
    shortLabel: "Done",
    statuses: ["Completed"],
    dropStatus: "Completed",
    stage: "complete"
  }
];

export function getPipelineGroup(key: PipelineGroupKey) {
  return PIPELINE_GROUPS.find((group) => group.key === key) ?? null;
}
