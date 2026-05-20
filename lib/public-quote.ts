import { randomBytes, timingSafeEqual } from "crypto";
import type { QuoteRecord } from "@/lib/types";

const LEGACY_PUBLIC_STATUSES = new Set(["Sent", "Accepted"]);

export function createQuotePublicToken() {
  return randomBytes(32).toString("base64url");
}

export function canUseLegacyPublicQuoteLink(quote: Pick<QuoteRecord, "status">) {
  return LEGACY_PUBLIC_STATUSES.has(quote.status);
}

export function validatePublicQuoteAccess(quote: Pick<QuoteRecord, "status" | "public_token">, token?: string | null) {
  if (token && quote.public_token && safeEqual(token, quote.public_token)) {
    return { ok: true as const, mode: "token" as const };
  }

  if (!token && canUseLegacyPublicQuoteLink(quote)) {
    return { ok: true as const, mode: "legacy" as const };
  }

  return { ok: false as const };
}

function safeEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}
