import type { JobStatus } from "@/lib/types";

export type PipelineGroupKey = "all" | "enquiry" | "survey" | "quote" | "won" | "preparing" | "on_site" | "complete" | "closed";

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
    key: "enquiry",
    label: "Enquiry",
    shortLabel: "Enquiry",
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
    key: "quote",
    label: "Quote",
    shortLabel: "Quote",
    statuses: ["Ready For AI Quote", "Quote Drafted", "Ready To Send", "Quote Sent", "Follow-Up Needed"],
    dropStatus: "Ready For AI Quote",
    stage: "ready"
  },
  {
    key: "won",
    label: "Won",
    shortLabel: "Won",
    statuses: ["Accepted"],
    dropStatus: "Accepted",
    stage: "active"
  },
  {
    key: "preparing",
    label: "Preparing",
    shortLabel: "Preparing",
    statuses: ["Materials Needed", "Materials Ordered", "Scaffold In Situ", "Booked"],
    dropStatus: "Materials Needed",
    stage: "active"
  },
  {
    key: "on_site",
    label: "On Site",
    shortLabel: "On Site",
    statuses: ["In Progress"],
    dropStatus: "In Progress",
    stage: "active"
  },
  {
    key: "complete",
    label: "Complete",
    shortLabel: "Complete",
    statuses: ["Completed"],
    dropStatus: "Completed",
    stage: "complete"
  },
  {
    key: "closed",
    label: "Closed",
    shortLabel: "Closed",
    statuses: ["Not Proceeding", "Lost"],
    dropStatus: "Not Proceeding",
    stage: "complete"
  }
];

export function getPipelineGroup(key: PipelineGroupKey) {
  return PIPELINE_GROUPS.find((group) => group.key === key) ?? null;
}
