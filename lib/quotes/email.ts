export const DEFAULT_QUOTE_EMAIL_MESSAGE =
  "Your roofing quotation is ready to review. Please use the button below to view the full details and next steps.";

export function cleanCustomerEmailBody(value?: string | null) {
  if (!value) return "";

  return value
    .replace(/,\s*chimneys?,\s*dormers?,?\s*(?:and|&)\s*skylights?/gi, "")
    .replace(/\bchimneys?,\s*dormers?,?\s*(?:and|&)\s*skylights?\b/gi, "")
    .replace(/\s+,/g, ",")
    .replace(/,\s*\./g, ".")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}
