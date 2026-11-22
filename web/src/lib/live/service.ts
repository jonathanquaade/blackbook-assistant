import { readBundle, type BundledIndex } from "./bundle";
import { parseLiveBrief } from "./brief";
import { embedQuery } from "./embed";
import { currentEligibility, EligibilityUnavailableError, type EligibilitySnapshot } from "./eligibility";
import { searchEntries, type BundledEntry } from "./memory-search";
import { usesBundledIndex } from "./paths";
import { searchIndex, type LiveFilters } from "./search";

export interface SearchRequest {
  query: string;
  filters?: LiveFilters;
  muted?: string[];
  ids?: string[];
  mode?: "hybrid" | "keyword";
}

export class IndexUnavailableError extends Error {}
export { EligibilityUnavailableError };

export const QUERY_EMBED_TIMEOUT_MS = 8_000;

/** Query embedding with a deadline. The model keeps loading in the background after a timeout. */
async function embedWithin(text: string, ms: number, embed: (text: string) => Promise<number[]>) {
  let timer: NodeJS.Timeout | undefined;
  try {
    return await Promise.race([
      embed(text),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error("timeout")), ms);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Intersects the bundled index with the current eligibility set: an entry stays only if every page
 * behind it is still Verified and rated 4 or 5. An employer that has since lost eligibility is
 * replaced by its Works At Link host. Ratings come from the fresh check.
 */
export function applyEligibility(entries: BundledEntry[], eligibility: Pick<EligibilitySnapshot, "ids" | "ratings">) {
  return entries
    .filter((entry) => entry.pageIds.every((id) => eligibility.ids.has(id)))
    .map((entry) => {
      const hide = entry.employerId && !eligibility.ids.has(entry.employerId);
      return {
        ...entry,
        employer: hide ? (entry.employerFallback ?? null) : entry.employer,
        rating: eligibility.ratings.get(entry.pageIds[0]) ?? entry.rating,
      };
    });
}

export interface BundledDeps {
  index: () => BundledIndex | null;
  eligibility: () => Promise<Pick<EligibilitySnapshot, "ids" | "ratings" | "checkedAt">>;
  embed: (text: string) => Promise<number[]>;
  embedTimeoutMs?: number;
}

/** Vercel path: bundled index, fresh eligibility, query embedding that degrades to keyword-only. */
export async function runBundledSearch(request: SearchRequest, deps: BundledDeps) {
  const started = performance.now();
  const index = deps.index();
  if (!index) throw new IndexUnavailableError("No index was built for this deployment.");
  const eligibility = await deps.eligibility();
  const query = request.query.slice(0, 500);
  const brief = parseLiveBrief(query, request.muted);
  let mode: "hybrid" | "keyword" = "keyword";
  let modeReason: string | null = request.mode === "keyword" ? "requested" : null;
  let queryVector: number[] | null = null;
  if (request.mode !== "keyword" && brief.terms.length) {
    if (!index.hasVectors) modeReason = "index built without embeddings";
    else
      try {
        queryVector = await embedWithin(brief.terms.join(" "), deps.embedTimeoutMs ?? QUERY_EMBED_TIMEOUT_MS, deps.embed);
        mode = "hybrid";
      } catch (error) {
        modeReason = error instanceof Error && error.message === "timeout" ? "model not ready in time" : "model unavailable";
      }
  } else if (request.mode !== "keyword" && index.hasVectors) mode = "hybrid";
  const eligible = applyEligibility(index.entries, eligibility);
  const found = searchEntries(eligible, { query, filters: request.filters, muted: request.muted, ids: request.ids, queryVector });
  return {
    mode,
    modeReason,
    brief: found.brief,
    results: found.results,
    ms: Math.round(performance.now() - started),
    indexBuiltAt: index.builtAt,
    eligibilityCheckedAt: new Date(eligibility.checkedAt).toISOString(),
  };
}

async function runLocalSearch(request: SearchRequest) {
  const { withIndex, readStatus } = await import("./store");
  const started = performance.now();
  const query = request.query.slice(0, 500);
  let mode: "hybrid" | "keyword" = request.mode ?? "hybrid";
  let queryVector: number[] | null = null;
  const brief = parseLiveBrief(query, request.muted);
  if (mode === "hybrid" && brief.terms.length) {
    try {
      queryVector = await embedQuery(brief.terms.join(" "));
    } catch {
      mode = "keyword";
    }
  }
  const response = await withIndex((db) =>
    searchIndex(db, { query, filters: request.filters, muted: request.muted, ids: request.ids, queryVector }),
  );
  if (!response) throw new IndexUnavailableError("The first Notion sync hasn't completed yet.");
  return {
    mode,
    modeReason: null,
    brief,
    results: response.results,
    ms: Math.round(performance.now() - started),
    indexBuiltAt: readStatus().lastGood?.at ?? null,
    eligibilityCheckedAt: null,
  };
}

export async function runSearch(request: SearchRequest) {
  if (!usesBundledIndex()) return runLocalSearch(request);
  return runBundledSearch(request, { index: readBundle, eligibility: currentEligibility, embed: embedQuery });
}
