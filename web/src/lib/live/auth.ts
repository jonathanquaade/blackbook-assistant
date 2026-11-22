import { createHash, timingSafeEqual } from "node:crypto";
import { liveSetting } from "./config";

export const ownerPassword = () => liveSetting("BLACKBOOK_OWNER_PASSWORD") || null;

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
