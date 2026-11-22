import type { SearchRequest } from "./service";

export const MAX_BODY_BYTES = 16_384;
export const MAX_ITEMS = 50;
const MAX_STRING = 200;

type Parsed = { ok: true; value: SearchRequest } | { ok: false; status: number; error: string };
const bad = (error: string, status = 400): Parsed => ({ ok: false, status, error });

const text = (value: unknown, max = MAX_STRING) => typeof value === "string" && value.length <= max;
const optionalText = (value: unknown) => value === undefined || value === null || text(value);
const list = (value: unknown, itemMax: number) =>
  Array.isArray(value) && value.length <= MAX_ITEMS && value.every((item) => text(item, itemMax));

/** Validates an already-parsed body and returns a clean request holding only known fields. */
export function validateSearchBody(body: unknown): Parsed {
  if (typeof body !== "object" || body === null || Array.isArray(body)) return bad("Invalid request.");
  const { query, filters, muted, ids, mode } = body as Record<string, unknown>;
  if (!text(query, 2000)) return bad("Invalid request: query.");
  const clean: SearchRequest = { query: query as string };
  if (filters !== undefined) {
    if (typeof filters !== "object" || filters === null || Array.isArray(filters)) return bad("Invalid request: filters.");
    const { capability, workStatus, type } = filters as Record<string, unknown>;
    if (![capability, workStatus, type].every(optionalText)) return bad("Invalid request: filters.");
    clean.filters = { capability: (capability as string) ?? null, workStatus: (workStatus as string) ?? null, type: (type as string) ?? null };
  }
  if (muted !== undefined) {
    if (!list(muted, 100)) return bad("Invalid request: muted.");
    clean.muted = muted as string[];
  }
  if (ids !== undefined) {
    if (!list(ids, 64)) return bad("Invalid request: ids.");
    clean.ids = ids as string[];
  }
  if (mode !== undefined) {
    if (mode !== "hybrid" && mode !== "keyword") return bad("Invalid request: mode.");
    clean.mode = mode;
  }
  return { ok: true, value: clean };
}

export async function parseSearchRequest(request: Request): Promise<Parsed> {
  const declared = Number(request.headers.get("content-length"));
  if (declared > MAX_BODY_BYTES) return bad("Request too large.", 413);
  const raw = await request.text().catch(() => null);
  if (raw === null) return bad("Invalid request.");
  if (Buffer.byteLength(raw) > MAX_BODY_BYTES) return bad("Request too large.", 413);
  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return bad("Invalid request.");
  }
  return validateSearchBody(body);
}
