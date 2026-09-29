import { describe, expect, it } from "vitest";
import { PIPELINE_GROUPS } from "@/lib/jobs/pipelineGroups";

describe("visible pipeline groups", () => {
  it("groups detailed statuses into roofing business phases", () => {
    expect(PIPELINE_GROUPS.map((group) => group.label)).toEqual([
      "Enquiry", "Survey", "Quote", "Won", "Preparing", "On Site", "Complete", "Closed"
    ]);
    expect(PIPELINE_GROUPS.find((group) => group.label === "Quote")?.statuses).toContain("Follow-Up Needed");
    expect(PIPELINE_GROUPS.find((group) => group.label === "Closed")?.statuses).toEqual(["Not Proceeding", "Lost"]);
  });
});
