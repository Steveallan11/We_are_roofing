export type QuickFollowUpKind = "quote" | "survey" | "work" | "general";

export type QuickFollowUpContext = {
  firstName: string;
  jobRef: string;
  jobTitle: string;
  propertyAddress?: string | null;
  jobStatus?: string | null;
  followUpDate?: string | null;
  quoteRef?: string | null;
  quoteStatus?: string | null;
  quoteTotal?: number | null;
};

export function buildQuickFollowUp(context: QuickFollowUpContext, kind: QuickFollowUpKind) {
  const firstName = context.firstName.trim() || "there";
  const jobName = context.jobTitle.trim() || context.jobRef;
  const location = context.propertyAddress?.trim();
  const jobLabel = location ? `${jobName} at ${location}` : jobName;
  const quoteRef = context.quoteRef?.trim();
  const quoteLabel = quoteRef ? ` (${quoteRef})` : "";
  const quoteValue = typeof context.quoteTotal === "number"
    ? ` The quotation total is £${context.quoteTotal.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}.`
    : "";

  if (kind === "quote") {
    return {
      subject: `Following up on your roofing quotation${quoteRef ? ` ${quoteRef}` : ""}`,
      body: `Hi ${firstName},\n\nI’m just following up on the quotation${quoteLabel} for ${jobLabel}.${quoteValue} Have you had a chance to look it over? If you have any questions about the proposed work or would like to talk through anything, just reply to this email and we’ll be happy to help.\n\nThere’s no pressure — I just wanted to make sure you have everything you need to decide on the next step.\n\nKind regards,\nWe Are Roofing`
    };
  }

  if (kind === "survey") {
    return {
      subject: `Following up on your roof survey — ${context.jobRef}`,
      body: `Hi ${firstName},\n\nI’m following up after the survey for ${jobLabel}. Please let us know if you have any questions about the findings or the next steps for the work.\n\nYou can reply to this email and we’ll be glad to help.\n\nKind regards,\nWe Are Roofing`
    };
  }

  if (kind === "work") {
    return {
      subject: `A quick update on ${context.jobRef}`,
      body: `Hi ${firstName},\n\nI’m getting in touch about ${jobLabel}. Please let us know if you have any questions or if there’s anything you’d like us to clarify about the work.\n\nJust reply here and we’ll get back to you.\n\nKind regards,\nWe Are Roofing`
    };
  }

  return {
    subject: `Checking in about ${context.jobRef}`,
    body: `Hi ${firstName},\n\nI wanted to check in about ${jobLabel}. Please let us know if you have any questions or if you’d like to discuss the next step.\n\nYou can reply to this email whenever convenient.\n\nKind regards,\nWe Are Roofing`
  };
}
