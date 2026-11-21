import { createHash } from "node:crypto";
import { mkdir, readFile, open, rm } from "node:fs/promises";
import path from "node:path";
import {
  object,
  parseReviewerReport,
  safeUrl,
  trainingCorrections,
  type OwnerReviewEvent,
  type ShadowEntry,
} from "./reviewer";

const PAGE_ID = /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i;
export function requirePageId(value: unknown): asserts value is string {
  if (typeof value !== "string" || !PAGE_ID.test(value))
    throw new Error("Choose a valid entry.");
}
function root() {
  const dir = process.env.BLACKBOOK_REVIEW_DATA_DIR;
  if (!dir || !path.isAbsolute(dir))
    throw new Error("Private review storage is not configured.");
  return dir;
}
async function optionalFile(file: string) {
  try {
    return await readFile(file, "utf8");
  } catch (e) {
    if (object(e).code === "ENOENT") return "";
    throw e;
  }
}
async function readJson(file: string): Promise<unknown> {
  const value = await optionalFile(file);
  if (!value) return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}
function property(
  page: Record<string, unknown>,
  name: string,
): Record<string, unknown> {
  const props = object(page.properties);
  if (props[name]) return object(props[name]);
  if (name === "Location") return object(props.Country);
  return {};
}
function plain(p: Record<string, unknown>): string {
  const value = p[String(p.type)];
  if (Array.isArray(value))
    return value
      .map((v) => String(object(v).plain_text ?? object(v).name ?? ""))
      .join(p.type === "multi_select" ? ", " : "");
  if (p.type === "select") return String(object(value).name ?? "");
  return typeof value === "string" || typeof value === "number"
    ? String(value)
    : "";
}
export function pageRevision(page: Record<string, unknown>) {
  const revision = Date.parse(String(page.last_edited_time));
  if (!Number.isSafeInteger(revision) || revision <= 0)
    throw new Error("The entry has no usable revision.");
  return revision;
}
let nextRead = 0;
async function notionRead(
  endpoint: string,
  query?: object,
): Promise<Record<string, unknown>> {
  const key = process.env.NOTION_API_KEY;
  if (!key) throw new Error("Read-only Notion access is not configured.");
  for (let attempt = 0; attempt < 4; attempt++) {
    const now = Date.now();
    const start = Math.max(now, nextRead);
    nextRead = start + 350;
    if (start > now)
      await new Promise((resolve) => setTimeout(resolve, start - now));
    const response = await fetch(`https://api.notion.com/v1/${endpoint}`, {
      method: query ? "POST" : "GET",
      cache: "no-store",
      signal: AbortSignal.timeout(20000),
      headers: {
        Authorization: `Bearer ${key}`,
        "Notion-Version": "2022-06-28",
        "Content-Type": "application/json",
      },
      ...(query ? { body: JSON.stringify(query) } : {}),
    });
    if (response.ok) return object(await response.json());
    if ((response.status === 429 || response.status >= 500) && attempt < 3) {
      const retry = Math.min(
        10,
        Math.max(
          1,
          Number(response.headers.get("retry-after")) || 2 ** attempt,
        ),
      );
      await new Promise((resolve) => setTimeout(resolve, retry * 1000));
      continue;
    }
    throw new Error(
      `Notion read failed (${response.status}). Nothing was written to Notion.`,
    );
  }
  throw new Error("Notion read is temporarily unavailable.");
}
async function fixturePages(): Promise<Record<string, unknown>[] | null> {
  if (process.env.BLACKBOOK_SHADOW_FIXTURES !== "1") return null;
  const pages = await readJson(path.join(root(), "pages.json"));
  if (!Array.isArray(pages))
    throw new Error("Fictional review pages are missing.");
  return pages.map(object);
}
export async function readPage(id: string): Promise<Record<string, unknown>> {
  requirePageId(id);
  const fixtures = await fixturePages();
  const page = fixtures
    ? fixtures.find((p) => p.id === id)
    : await notionRead(`pages/${id}`);
  const db = process.env.NOTION_DATABASE_ID?.replaceAll("-", "");
  if (
    !page ||
    (!fixtures &&
      (!db ||
        String(object(page.parent).database_id).replaceAll("-", "") !== db))
  )
    throw new Error("Entry is outside this Blackbook.");
  if (
    page.archived ||
    page.in_trash ||
    plain(property(page, "Entry Status")) !== "Needs Review"
  )
    throw new Error("This entry is no longer Needs Review. Reload the queue.");
  return page;
}
export async function shadowEntry(
  page: Record<string, unknown>,
  includeMedia = true,
): Promise<ShadowEntry> {
  const id = page.id;
  requirePageId(id);
  const raw = await optionalFile(
    path.join(root(), "review-feedback", `${id}.json`),
  );
  let report = null;
  try {
    report = parseReviewerReport(JSON.parse(raw));
  } catch {
    /* Missing or malformed reports are untrusted. */
  }
  const assets = process.env.BLACKBOOK_REVIEW_ASSETS_DIR;
  const manifestValue = includeMedia
    ? await readJson(
        assets && path.isAbsolute(assets)
          ? path.join(assets, id, "manifest.json")
          : path.join(root(), "manifests", `${id}.json`),
      )
    : null;
  const manifest = Array.isArray(manifestValue)
    ? manifestValue.map(object)
    : [];
  const files = property(page, "Images").files;
  const images: ShadowEntry["images"] = [];
  if (includeMedia && Array.isArray(files))
    for (const value of files) {
      const f = object(value),
        file = object(f.file),
        url = safeUrl(file.url);
      const item = manifest.find((m) => m.file === f.name);
      if (
        f.type !== "file" ||
        !url ||
        item?.rejected === true ||
        (file.expiry_time && Date.parse(String(file.expiry_time)) <= Date.now())
      )
        continue;
      images.push({
        name: String(f.name ?? "Selected work"),
        url,
        caption: String(item?.caption ?? f.name ?? "Portfolio image"),
        source: safeUrl(item?.link),
      });
    }
  const capabilities = property(page, "Capabilities").multi_select;
  return {
    page_id: id,
    name: plain(property(page, "Name")) || "Unnamed entry",
    revision: pageRevision(page),
    edited_at: String(page.last_edited_time),
    type: plain(property(page, "Type")) || "Unknown",
    location: plain(property(page, "Location")) || "Unknown",
    work_status: plain(property(page, "Work Status")) || "Unknown",
    capabilities: Array.isArray(capabilities)
      ? capabilities.map((c) => String(object(c).name)).sort()
      : [],
    summary: includeMedia ? plain(property(page, "AI Notes")) : "",
    questions: includeMedia ? plain(property(page, "Open Questions")) : "",
    notes: includeMedia ? plain(property(page, "Notes")) : "",
    judgments: {
      Rating: includeMedia ? plain(property(page, "Rating")) : "",
      "Work With?": includeMedia ? plain(property(page, "Work With?")) : "",
      "Worked Together": includeMedia
        ? plain(property(page, "Worked Together"))
        : "",
      Familiarity: includeMedia ? plain(property(page, "Familiarity")) : "",
    },
    links: includeMedia
      ? ["Website", "Instagram", "LinkedIn"].flatMap((label) => {
          const url = safeUrl(plain(property(page, label)));
          return url ? [{ label, url }] : [];
        })
      : [],
    images,
    report,
    report_hash: createHash("sha256").update(raw).digest("hex"),
  };
}
export async function reviewEvents(): Promise<OwnerReviewEvent[]> {
  const text = await optionalFile(path.join(root(), "owner-review.jsonl"));
  return text
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line) as OwnerReviewEvent);
}
export async function reviewQueue() {
  const fixtures = await fixturePages();
  let pages: Record<string, unknown>[] = fixtures ?? [];
  if (!fixtures) {
    const db = process.env.NOTION_DATABASE_ID;
    if (!db || !/^[\da-f-]{32,36}$/i.test(db))
      throw new Error("Blackbook database is not configured.");
    let cursor: unknown;
    do {
      const result = await notionRead(`databases/${db}/query`, {
        page_size: 100,
        filter: {
          property: "Entry Status",
          select: { equals: "Needs Review" },
        },
        ...(cursor ? { start_cursor: cursor } : {}),
      });
      if (!Array.isArray(result.results))
        throw new Error("Notion returned an invalid queue.");
      pages = pages.concat(result.results.map(object));
      cursor = result.has_more ? result.next_cursor : undefined;
    } while (cursor);
  }
  pages = pages.filter(
    (p) =>
      !p.archived &&
      !p.in_trash &&
      plain(property(p, "Entry Status")) === "Needs Review",
  );
  return {
    entries: await Promise.all(pages.map((p) => shadowEntry(p, false))),
    events: await reviewEvents(),
    fictional: Boolean(fixtures),
  };
}
export function parseOwnerEvent(
  value: unknown,
): Omit<OwnerReviewEvent, "date"> {
  const p = object(value);
  const allowed = [
    "kind",
    "id",
    "page_id",
    "revision",
    "report_hash",
    "check",
    "result",
    "reason",
    "checks",
    "note",
  ];
  if (Object.keys(p).some((k) => !allowed.includes(k)))
    throw new Error(
      "Only owner review feedback is accepted. Profile fields cannot be written.",
    );
  requirePageId(p.page_id);
  requirePageId(p.id);
  if (
    !["check", "approve", "request-changes", "reject"].includes(
      String(p.kind),
    ) ||
    !Number.isSafeInteger(p.revision) ||
    typeof p.report_hash !== "string" ||
    !/^[a-f0-9]{64}$/.test(p.report_hash) ||
    typeof p.note !== "string" ||
    p.note.length > 2000 ||
    !Array.isArray(p.checks) ||
    p.checks.some((c) => typeof c !== "string")
  )
    throw new Error("Review feedback is invalid.");
  return {
    id: p.id,
    page_id: p.page_id,
    revision: Number(p.revision),
    report_hash: p.report_hash,
    action: p.kind as OwnerReviewEvent["action"],
    check: typeof p.check === "string" ? p.check : undefined,
    result: p.result as OwnerReviewEvent["result"],
    reason: p.reason as OwnerReviewEvent["reason"],
    checks: [...new Set(p.checks as string[])],
    note: p.note.trim(),
  };
}
async function durableAppend(file: string, lines: object[]) {
  if (!lines.length) return;
  const handle = await open(file, "a", 0o600);
  try {
    await handle.writeFile(
      lines.map((line) => JSON.stringify(line)).join("\n") + "\n",
    );
    await handle.sync();
  } finally {
    await handle.close();
  }
}
export async function saveOwnerEvent(input: Omit<OwnerReviewEvent, "date">) {
  const dir = root();
  await mkdir(dir, { recursive: true });
  const lock = path.join(dir, ".owner-review-lock");
  try {
    await mkdir(lock);
  } catch (e) {
    if (object(e).code === "EEXIST")
      throw new Error("Another review is saving. Try again in a moment.");
    throw e;
  }
  try {
    const history = await reviewEvents();
    const existing = history.find((e) => e.id === input.id);
    if (existing) return existing;
    const entry = await shadowEntry(await readPage(input.page_id));
    if (
      history.some(
        (e) =>
          e.page_id === entry.page_id &&
          e.revision === entry.revision &&
          e.action !== "check",
      )
    )
      throw new Error("A decision is already saved for this revision.");
    const event = { ...input, date: new Date().toISOString() };
    const corrections = trainingCorrections(entry, event);
    const correctionFile = path.join(dir, "reviewer-corrections.jsonl");
    const previous = (await optionalFile(correctionFile))
      .split("\n")
      .filter(Boolean)
      .map((line) => object(JSON.parse(line)));
    await durableAppend(
      correctionFile,
      corrections.filter(
        (c) =>
          !previous.some(
            (p) => p.event_id === c.event_id && p.check === c.check,
          ),
      ),
    );
    await durableAppend(path.join(dir, "owner-review.jsonl"), [event]);
    return event;
  } finally {
    await rm(lock, { recursive: true });
  }
}
