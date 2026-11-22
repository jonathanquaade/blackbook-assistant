import { NextResponse, type NextRequest } from "next/server";
import { ownerPassword } from "./lib/live/auth";
import { requireOwner } from "./lib/live/guard";

export async function proxy(request: NextRequest) {
  // Without live mode the pages are the public sandbox; only the live APIs are closed.
  if (!ownerPassword() && !request.nextUrl.pathname.startsWith("/api/")) return NextResponse.next();
  const denied = await requireOwner(request.headers);
  return denied ?? NextResponse.next({ headers: { "Cache-Control": "private, no-store" } });
}

export const config = { matcher: ["/explore", "/api/search", "/api/media"] };
