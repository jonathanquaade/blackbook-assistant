import { NextResponse, type NextRequest } from "next/server";
import { requireOwner } from "@/lib/live/guard";
import { signedImageUrl } from "@/lib/live/media";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const denied = await requireOwner(request.headers);
  if (denied) return denied;
  const page = request.nextUrl.searchParams.get("page") ?? "";
  const file = request.nextUrl.searchParams.get("file") ?? "";
  if (!/^[0-9a-f-]{32,36}$/.test(page) || !file) return new NextResponse(null, { status: 400 });
  try {
    const url = await signedImageUrl(page, file);
    if (!url) return new NextResponse(null, { status: 404 });
    return NextResponse.redirect(url, { status: 302, headers: { "Cache-Control": "private, no-store" } });
  } catch {
    return new NextResponse(null, { status: 503 });
  }
}
