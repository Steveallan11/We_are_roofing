import type { JobStatus } from "@/lib/types";

export type PipelineGroupKey = "all" | "new" | "survey" | "quoting" | "sent" | "booked";

export type PipelineGroup = {
  key: PipelineGroupKey;
  label: string;
  shortLabel: string;
  statuses: JobStatus[];
};

export const PIPELINE_GROUPS: PipelineGroup[] = [
  {
    key: "new",
    label: "New Leads",
    shortLabel: "New Leads",
    statuses: ["New Lead"]
  },
  {
    key: "survey",
    label: "Survey",
    shortLabel: "Survey",
    statuses: ["Survey Needed", "Survey Complete"]
  },
  {
    key: "quoting",
    label: "Quoting",
    shortLabel: "Quoting",
    statuses: ["Ready For AI Quote", "Quote Drafted", "Ready To Send"]
  },
  {
    key: "sent",
    label: "Sent",
    shortLabel: "Awaiting Reply",
    statuses: ["Quote Sent", "Follow-Up Needed"]
  },
  {
    key: "booked",
    label: "Booked / Active",
    shortLabel: "Booked In",
    statuses: ["Accepted", "Materials Needed", "Booked"]
  }
];

export function getPipelineGroup(key: PipelineGroupKey) {
  return PIPELINE_GROUPS.find((group) => group.key === key) ?? null;
}
