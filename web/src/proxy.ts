import { NextResponse, type NextRequest } from "next/server";
import { isOwner, ownerPassword } from "./lib/live/auth";

export function proxy(request: NextRequest) {
  const password = ownerPassword();
  const headers = { "Cache-Control": "private, no-store" };
  if (!password) {
    return request.nextUrl.pathname.startsWith("/api/")
      ? new NextResponse(null, { status: 404, headers })
      : NextResponse.next();
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
