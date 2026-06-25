export function cleanCustomerEmailBody(value?: string | null) {
  if (!value) return "";

  return value
    .replace(/[^.!?\n]*\bchimneys,\s*dormers,?\s*(?:and|&)\s*skylights\b[^.!?\n]*[.!?]?/gi, "")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}
