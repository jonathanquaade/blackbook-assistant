import { NextResponse, type NextRequest } from "next/server";
import { allowsOwnerTransport, isOwner, ownerPassword } from "./lib/live/auth";
import { liveSetting } from "./lib/live/config";

export function proxy(request: NextRequest) {
  const password = ownerPassword();
  const headers = { "Cache-Control": "private, no-store" };
  if (!password) {
    return request.nextUrl.pathname.startsWith("/api/")
      ? new NextResponse(null, { status: 404, headers })
      : NextResponse.next();
  }
  if (!allowsOwnerTransport(request.headers, liveSetting("BLACKBOOK_ALLOW_HTTP_LOOPBACK") === "1")) {
    return new NextResponse("Live Explore requires HTTPS.", { status: 403, headers });
  }
  if (!isOwner(request.headers.get("authorization"), password)) {
    return new NextResponse("Blackbook owner access required.", {
      status: 401,
      headers: { ...headers, "WWW-Authenticate": 'Basic realm="Blackbook", charset="UTF-8"' },
    });
  }
  return NextResponse.next({ headers });
}

export const config = { matcher: ["/explore", "/api/search", "/api/media"] };
