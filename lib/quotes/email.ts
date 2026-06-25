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
