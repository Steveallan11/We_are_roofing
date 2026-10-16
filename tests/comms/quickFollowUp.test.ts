import { describe, expect, it } from "vitest";
import { buildQuickFollowUp } from "@/lib/comms/quickFollowUp";

const context = {
  firstName: "Theo",
  jobRef: "WR-J-20261007-0FD3",
  jobTitle: "Extension roof leak - Velux remedial works",
  propertyAddress: "3 Castercourt, Yateley",
  jobStatus: "Quote Sent",
  quoteRef: "WR-Q-1031",
  quoteStatus: "Sent",
  quoteTotal: 834
};

describe("buildQuickFollowUp", () => {
  it("builds a quote follow-up from verified job and quote context", () => {
    const draft = buildQuickFollowUp(context, "quote");
    expect(draft.subject).toContain("WR-Q-1031");
    expect(draft.body).toContain("Hi Theo");
    expect(draft.body).toContain("3 Castercourt, Yateley");
    expect(draft.body).toContain("£834.00");
  });

  it("does not invent quote references or amounts when the job has no quote details", () => {
    const draft = buildQuickFollowUp({ ...context, quoteRef: null, quoteTotal: null }, "quote");
    expect(draft.subject).not.toContain("WR-Q-");
    expect(draft.body).not.toContain("£");
  });

  it("keeps internal pipeline labels out of customer emails", () => {
    const draft = buildQuickFollowUp(context, "work");
    expect(draft.body).toContain("Extension roof leak - Velux remedial works");
    expect(draft.body).not.toContain("Quote Sent");
    expect(buildQuickFollowUp(context, "general").body).not.toContain("Quote Sent");
  });
});
