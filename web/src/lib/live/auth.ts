import { createHash, timingSafeEqual } from "node:crypto";
import { liveSetting } from "./config";

export const ownerPassword = () => liveSetting("BLACKBOOK_OWNER_PASSWORD") || null;

export function isOwner(authorization: string | null, password: string) {
  const token = authorization?.match(/^Basic ([A-Za-z0-9+/]+={0,2})$/i)?.[1];
  if (!token) return false;
  const credentials = Buffer.from(token, "base64");
  const digest = (value: string | Buffer) => createHash("sha256").update(value).digest();
  return timingSafeEqual(digest(credentials), digest(`jonathan:${password}`));
}
