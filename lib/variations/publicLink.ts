import { randomBytes, timingSafeEqual } from "crypto";

export function createVariationPublicToken() {
  return randomBytes(32).toString("base64url");
}

export function verifyVariationPublicToken(storedToken: string | null | undefined, providedToken: string | null | undefined) {
  if (!storedToken || !providedToken) return false;
  const stored = Buffer.from(storedToken);
  const provided = Buffer.from(providedToken);
  return stored.length === provided.length && timingSafeEqual(stored, provided);
}
