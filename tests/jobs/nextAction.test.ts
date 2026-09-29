import { describe, expect, it } from "vitest";
import { getNextAction } from "@/lib/jobs/nextAction";
import type { JobForAction } from "@/lib/jobs/nextAction";

function job(status: JobForAction["status"], extra: Partial<JobForAction> = {}): JobForAction {
  return { id: "job-1", status, ...extra } as JobForAction;
}

describe("job next actions", () => {
  it("turns detailed workflow states into plain next steps", () => {
    expect(getNextAction(job("New Lead")).label).toBe("Review enquiry / arrange survey");
    expect(getNextAction(job("Survey Complete")).label).toBe("Prepare quote");
    expect(getNextAction(job("Accepted")).label).toBe("Prepare job");
    expect(getNextAction(job("In Progress")).label).toBe("Continue / update job");
  });

  it("waits before prompting a quote follow-up", () => {
    expect(getNextAction(job("Quote Sent", { quote_sent_at: new Date().toISOString() })).label).toBe("Await customer response");
    expect(getNextAction(job("Quote Sent", { quote_sent_at: "2020-01-01T00:00:00.000Z" })).label).toBe("Follow up with customer");
  });

  it("does not suggest operational work for closed jobs", () => {
    expect(getNextAction(job("Not Proceeding")).label).toBe("No action needed");
    expect(getNextAction(job("Lost")).label).toBe("No action needed");
    expect(getNextAction(job("Archived")).label).toBe("No action needed");
  });
});
