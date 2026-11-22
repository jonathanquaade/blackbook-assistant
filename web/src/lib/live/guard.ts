import { NextResponse } from "next/server";
import { allowsOwnerTransport, clientAddress, failedLogins, isOwner, ownerPassword } from "./auth";
import { liveSetting } from "./config";

const NO_STORE = { "Cache-Control": "private, no-store" };

/**
 * Owner gate shared by proxy.ts and every live route handler (defense in depth: a matcher change
 * in the proxy must not be able to expose an API). Returns a response to send, or null when the
 * caller is the owner.
 */
export async function requireOwner(headers: Headers): Promise<NextResponse | null> {
  const password = ownerPassword();
  if (!password) return new NextResponse(null, { status: 404, headers: NO_STORE });
  if (!allowsOwnerTransport(headers, liveSetting("BLACKBOOK_ALLOW_HTTP_LOOPBACK") === "1"))
    return new NextResponse("Live Explore requires HTTPS.", { status: 403, headers: NO_STORE });
  const client = clientAddress(headers);
  const authorization = headers.get("authorization");
  if (isOwner(authorization, password)) {
    failedLogins.succeed(client);
    return null;
  }
  // The browser's first, credential-less request is not a failed guess.
  if (authorization) await new Promise((resolve) => setTimeout(resolve, failedLogins.fail(client)));
  return new NextResponse("Blackbook owner access required.", {
    status: 401,
    headers: { ...NO_STORE, "WWW-Authenticate": 'Basic realm="Blackbook", charset="UTF-8"' },
  });
}
