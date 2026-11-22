import { createHash, timingSafeEqual } from "node:crypto";
import { liveSetting } from "./config";

export const MIN_PASSWORD_LENGTH = 12;
const warned = globalThis as unknown as { __blackbookShortPasswordWarned?: boolean };

/**
 * The owner password, or null when live mode is off. A password shorter than 12 characters is
 * treated as absent (live mode stays disabled) so a guessable value never protects real data.
 */
export function ownerPassword() {
  const value = liveSetting("BLACKBOOK_OWNER_PASSWORD");
  if (!value) return null;
  if (value.length < MIN_PASSWORD_LENGTH) {
    if (!warned.__blackbookShortPasswordWarned) {
      warned.__blackbookShortPasswordWarned = true;
      console.warn(`Live mode disabled: BLACKBOOK_OWNER_PASSWORD must be at least ${MIN_PASSWORD_LENGTH} characters.`);
    }
    return null;
  }
  return value;
}

export function allowsOwnerTransport(headers: Headers, allowHttpLoopback: boolean) {
  const proto = headers.get("x-forwarded-proto");
  if (proto === "https") return true;
  const host = headers.get("host");
  const forwardedHost = headers.get("x-forwarded-host");
  return allowHttpLoopback &&
    (proto === null || proto === "http") &&
    /^(?:localhost|127\.0\.0\.1)(?::\d+)?$/.test(host ?? "") &&
    (forwardedHost === null || forwardedHost === host);
}

export function isOwner(authorization: string | null, password: string) {
  const token = authorization?.match(/^Basic ([A-Za-z0-9+/]+={0,2})$/i)?.[1];
  if (!token) return false;
  const credentials = Buffer.from(token, "base64");
  const digest = (value: string | Buffer) => createHash("sha256").update(value).digest();
  return timingSafeEqual(digest(credentials), digest(`jonathan:${password}`));
}

/**
 * Best-effort throttle for wrong passwords: the Nth recent failure from one client address waits
 * 250ms * 2^(N-1), capped at 8s, before the 401 is sent. State is per process memory, so on
 * serverless it resets whenever an instance is recycled and is not shared between instances. It
 * slows casual guessing only; the 12 character minimum random password is the real protection.
 */
export function createFailureTracker(now: () => number = Date.now, windowMs = 15 * 60_000, maxClients = 500) {
  const failures = new Map<string, { count: number; last: number }>();
  return {
    /** Records a failed attempt and returns how long to wait before answering. */
    fail(client: string) {
      const t = now();
      for (const [key, value] of failures) if (t - value.last > windowMs) failures.delete(key);
      const count = (failures.get(client)?.count ?? 0) + 1;
      failures.delete(client);
      failures.set(client, { count, last: t });
      if (failures.size > maxClients) failures.delete(failures.keys().next().value as string);
      return Math.min(250 * 2 ** (count - 1), 8000);
    },
    succeed(client: string) {
      failures.delete(client);
    },
  };
}

export const failedLogins = createFailureTracker();

export function clientAddress(headers: Headers) {
  const forwarded = headers.get("x-forwarded-for")?.split(",").pop()?.trim();
  return headers.get("x-real-ip")?.trim() || forwarded || "unknown";
}
