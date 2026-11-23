import { NextResponse } from "next/server";
import { requireOwner } from "@/lib/live/guard";
import { parseSearchRequest } from "@/lib/live/request";
import { EligibilityUnavailableError, IndexUnavailableError, runSearch } from "@/lib/live/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

const noStore = { "Cache-Control": "no-store" };

export async function POST(request: Request) {
  const denied = await requireOwner(request.headers);
  if (denied) return denied;
  const parsed = await parseSearchRequest(request);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: parsed.status, headers: noStore });
  try {
    return NextResponse.json(await runSearch(parsed.value), { headers: noStore });
  } catch (error) {
    if (error instanceof IndexUnavailableError)
      return NextResponse.json({ error: "The Blackbook index is not available for this deployment yet." }, { status: 503, headers: noStore });
    if (error instanceof EligibilityUnavailableError)
      return NextResponse.json({ error: "Eligibility could not be checked right now, so no results are shown. Try again shortly." }, { status: 503, headers: noStore });
    // Never echo the cause: it may carry upstream detail.
    return NextResponse.json({ error: "Search failed." }, { status: 500, headers: noStore });
  }
}
