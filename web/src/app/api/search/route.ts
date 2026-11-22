import { NextResponse } from "next/server";
import { runSearch, type SearchRequest } from "@/lib/live/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as SearchRequest | null;
  if (!body || typeof body.query !== "string") return NextResponse.json({ error: "query required" }, { status: 400 });
  const result = await runSearch(body);
  if (!result) return NextResponse.json({ error: "The first Notion sync hasn’t completed yet." }, { status: 503 });
  return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
}
