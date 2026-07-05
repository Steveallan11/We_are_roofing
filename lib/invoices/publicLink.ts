import { createHmac, timingSafeEqual } from "crypto";

const TOKEN_TTL_SECONDS = 60 * 60 * 24 * 180;

function getSecret() {
  return (
    process.env.INVOICE_FILE_LINK_SECRET ||
    process.env.INVOICE_LINK_SECRET ||
    process.env.NEXTAUTH_SECRET ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.RESEND_API_KEY ||
    ""
  );
}

function sign(value: string) {
  const secret = getSecret();
  if (!secret) throw new Error("Invoice link signing secret is not configured.");
  return createHmac("sha256", secret).update(value).digest("base64url");
}

export function createInvoiceFileToken(invoiceId: string, now = new Date()) {
  const issuedAt = Math.floor(now.getTime() / 1000);
  const payload = `${invoiceId}.${issuedAt}`;
  return `${issuedAt}.${sign(payload)}`;
}

export function verifyInvoiceFileToken(invoiceId: string, token: string | null) {
  if (!token) return false;
  const [issuedAtRaw, providedSignature] = token.split(".");
  if (!issuedAtRaw || !providedSignature) return false;

  const issuedAt = Number(issuedAtRaw);
  if (!Number.isFinite(issuedAt) || issuedAt <= 0) return false;
  if (Math.floor(Date.now() / 1000) - issuedAt > TOKEN_TTL_SECONDS) return false;

  let expectedSignature: string;
  try {
    expectedSignature = sign(`${invoiceId}.${issuedAt}`);
  } catch {
    return false;
  }

  const provided = Buffer.from(providedSignature);
  const expected = Buffer.from(expectedSignature);
  return provided.length === expected.length && timingSafeEqual(provided, expected);
}

export function appendInvoiceFileToken(url: string, invoiceId: string) {
  const token = createInvoiceFileToken(invoiceId);
  const separator = url.includes("?") ? "&" : "?";
  return `${url}${separator}token=${encodeURIComponent(token)}`;
}
