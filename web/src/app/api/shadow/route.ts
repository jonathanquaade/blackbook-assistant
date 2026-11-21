import { NextRequest, NextResponse } from "next/server";
import {
  OWNER_COOKIE,
  configuredSecret,
  ownerKeyMatches,
  ownerSession,
  sameOwnerOrigin,
  validOwnerSession,
} from "@/lib/owner-session";
import { object } from "@/lib/reviewer";
import {
  parseOwnerEvent,
  readPage,
  reviewQueue,
  saveOwnerEvent,
  shadowEntry,
} from "@/lib/shadow-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const headers = {
  "Cache-Control": "private, no-store",
  "Referrer-Policy": "no-referrer",
};
const reply = (body: unknown, status = 200) =>
  NextResponse.json(body, { status, headers });
let attempts: number[] = [];
export async function GET(request: NextRequest) {
  const secret = configuredSecret();
  if (!secret)
    return reply(
      {
        error:
          "Private review is disconnected. Configure an owner key before loading real entries.",
      },
      503,
    );
  if (!validOwnerSession(request.cookies.get(OWNER_COOKIE)?.value, secret))
    return reply({ error: "Owner sign-in required." }, 401);
  try {
    const id = request.nextUrl.searchParams.get("page_id");
    return reply(
      id ? await shadowEntry(await readPage(id)) : await reviewQueue(),
    );
  } catch (error) {
    return reply(
      {
        error:
          error instanceof Error
            ? error.message
            : "Could not load private review.",
      },
      409,
    );
  }
}
export async function POST(request: NextRequest) {
  const secret = configuredSecret();
  if (!secret) return reply({ error: "Private review is disconnected." }, 503);
  if (
    !sameOwnerOrigin(
      request.headers.get("origin"),
      process.env.BLACKBOOK_OWNER_ORIGIN,
    )
  )
    return reply(
      { error: "Review requests must come from the configured owner origin." },
      403,
    );
  try {
    const text = await request.text();
    if (text.length > 16000)
      return reply({ error: "Review feedback is too large." }, 413);
    const body = object(JSON.parse(text));
    if (body.kind === "login") {
      const now = Date.now();
      attempts = attempts.filter((time) => now - time < 10 * 60 * 1000);
      if (attempts.length >= 20)
        return reply(
          { error: "Too many sign-in attempts. Try again in ten minutes." },
          429,
        );
      attempts.push(now);
      if (typeof body.key !== "string" || !ownerKeyMatches(body.key, secret))
        return reply({ error: "Owner key not recognised." }, 401);
      const response = reply({ ok: true });
      response.cookies.set(OWNER_COOKIE, ownerSession(secret), {
        httpOnly: true,
        secure: process.env.BLACKBOOK_OWNER_ORIGIN?.startsWith("https://"),
        sameSite: "strict",
        path: "/",
        maxAge: 8 * 60 * 60,
      });
      return response;
    }
    if (!validOwnerSession(request.cookies.get(OWNER_COOKIE)?.value, secret))
      return reply({ error: "Owner sign-in required." }, 401);
    if (body.kind === "logout") {
      const response = reply({ ok: true });
      response.cookies.set(OWNER_COOKIE, "", {
        httpOnly: true,
        secure: process.env.BLACKBOOK_OWNER_ORIGIN?.startsWith("https://"),
        sameSite: "strict",
        path: "/",
        maxAge: 0,
      });
      return response;
    }
    return reply({ event: await saveOwnerEvent(parseOwnerEvent(body)) });
  } catch (error) {
    return reply(
      {
        error:
          error instanceof Error
            ? error.message
            : "Feedback was not saved. Try again.",
      },
      409,
    );
  }
}
