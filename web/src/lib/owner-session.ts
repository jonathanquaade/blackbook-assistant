import { createHash, createHmac, timingSafeEqual } from "node:crypto";

export const OWNER_COOKIE = "blackbook-owner";
export function configuredSecret(value = process.env.BLACKBOOK_OWNER_SECRET) {
  return value && value.length >= 32 ? value : null;
}
function equal(a: string, b: string) {
  return timingSafeEqual(
    createHash("sha256").update(a).digest(),
    createHash("sha256").update(b).digest(),
  );
}
export function ownerKeyMatches(key: string, secret: string) {
  return equal(key, secret);
}
export function ownerSession(secret: string, now = Date.now()) {
  const expires = String(now + 8 * 60 * 60 * 1000);
  return `${expires}.${createHmac("sha256", secret).update(`owner:${expires}`).digest("base64url")}`;
}
export function validOwnerSession(
  token: string | undefined,
  secret: string,
  now = Date.now(),
) {
  if (!token || !/^\d{13}\.[\w-]{43}$/.test(token)) return false;
  const [expires, signature] = token.split(".");
  if (Number(expires) <= now || Number(expires) > now + 8 * 60 * 60 * 1000)
    return false;
  return equal(
    signature,
    createHmac("sha256", secret).update(`owner:${expires}`).digest("base64url"),
  );
}
export function sameOwnerOrigin(
  origin: string | null,
  expected: string | undefined,
) {
  if (!origin || !expected) return false;
  try {
    return (
      new URL(origin).origin === expected &&
      ["http:", "https:"].includes(new URL(expected).protocol)
    );
  } catch {
    return false;
  }
}
