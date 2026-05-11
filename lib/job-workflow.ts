import type { Customer, Job, JobStatus, KanbanColumn, QuoteRecord } from "@/lib/types";

export const JOBS_BOARD_COLUMNS: Array<{
  status: JobStatus;
  label: string;
  description: string;
}> = [
  {
    status: "New Lead",
    label: "New Lead",
    description: "Fresh enquiries that need first review and booking."
  },
  {
    status: "Survey Needed",
    label: "Survey Needed",
    description: "Lead is qualified and ready to be booked for site."
  },
  {
    status: "Survey Complete",
    label: "Survey Complete",
    description: "Survey is saved but photos or quote prep still need attention."
  },
  {
    status: "Ready For AI Quote",
    label: "Ready For Quote",
    description: "Survey and evidence are in place. Draft the quote."
  },
  {
    status: "Quote Drafted",
    label: "Quote Drafted",
    description: "AI draft exists and needs checking."
  },
  {
    status: "Ready To Send",
    label: "Ready To Send",
    description: "Approved draft ready to send to the customer."
  },
  {
    status: "Quote Sent",
    label: "Quote Sent",
    description: "Customer has the quote. Awaiting response or follow-up."
  },
  {
    status: "Accepted",
    label: "Accepted",
    description: "Customer has accepted. Ready for ordering and handover."
  },
  {
    status: "Booked",
    label: "Booked",
    description: "Work is booked into the diary."
  },
  {
    status: "Completed",
    label: "Completed",
    description: "Job is complete and closed."
  }
];

export const SECONDARY_JOB_STATUSES: JobStatus[] = ["Follow-Up Needed", "Materials Needed", "Lost", "Archived"];

export type JobWithContext = Job & {
  customer?: Customer | null;
  quote?: QuoteRecord | null;
};

export function getStatusDisplayLabel(status: JobStatus) {
  return JOBS_BOARD_COLUMNS.find((column) => column.status === status)?.label ?? status;
}

export function getStatusDescription(status: JobStatus) {
  return JOBS_BOARD_COLUMNS.find((column) => column.status === status)?.description ?? "Supporting workflow state.";
}

export function getNextActionLabel(job: JobWithContext) {
  switch (job.status) {
    case "New Lead":
      return "Review lead and book survey";
    case "Survey Needed":
      return "Complete site survey";
    case "Survey Complete":
      return "Upload photos or confirm no-photo quote";
    case "Ready For AI Quote":
      return "Generate quote draft";
    case "Quote Drafted":
      return "Review and edit draft";
    case "Ready To Send":
      return "Send approved quote";
    case "Quote Sent":
      return "Follow up with customer";
    case "Accepted":
      return "Order materials and book work";
    case "Materials Needed":
      return "Confirm materials list";
    case "Booked":
      return "Prepare install handover";
    case "Completed":
      return "Archive and record final value";
    case "Lost":
      return "Record outcome and archive";
    case "Archived":
      return "Reference only";
    case "Follow-Up Needed":
      return "Call customer and update outcome";
    default:
      return "Review job file";
  }
}

export function getJobWorkflowMetrics(jobs: JobWithContext[]) {
  return {
    needingSurvey: jobs.filter((job) => job.status === "New Lead" || job.status === "Survey Needed").length,
    readyForQuote: jobs.filter((job) => job.status === "Ready For AI Quote").length,
    readyToSend: jobs.filter((job) => job.status === "Ready To Send").length,
    acceptedOrBooked: jobs.filter((job) => job.status === "Accepted" || job.status === "Booked").length
  };
}

export function groupJobsIntoColumns(jobs: JobWithContext[]): KanbanColumn[] {
  return JOBS_BOARD_COLUMNS.map((column) => ({
    status: column.status,
    label: column.label,
    description: column.description,
    jobs: jobs.filter((job) => job.status === column.status)
  }));
}

export function getMoveableStatuses(currentStatus: JobStatus) {
  return JOBS_BOARD_COLUMNS.map((column) => column.status).filter((status) => status !== currentStatus);
}
