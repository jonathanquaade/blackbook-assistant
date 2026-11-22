import { queryEligiblePages } from "./notion";
import { readEligibility, type NotionPage } from "./projection";

export const ELIGIBILITY_TTL_MS = 60_000;
export const ELIGIBILITY_MAX_STALE_MS = 5 * 60_000;

export class EligibilityUnavailableError extends Error {
  constructor() {
    super("Eligibility could not be checked against Notion.");
  }
}

export interface EligibilitySnapshot {
  /** Page ids that are, right now, Verified and rated 4 or 5. */
  ids: Set<string>;
  ratings: Map<string, number>;
  /** The eligible pages themselves, in memory only, for signed image links. */
  pages: NotionPage[];
  checkedAt: number;
}

/**
 * The live half of the hard rule (Verified AND Rating 4 or 5). One read-only database query,
 * cached in memory for at most `ttlMs`. If a refresh fails the previous result is reused only while
 * it is younger than `maxStaleMs`; after that this fails closed and callers must refuse to serve.
 * Every page is re-checked with readEligibility, whatever the query filter returned.
 */
export function createEligibilityChecker(
  load: () => Promise<NotionPage[]> = queryEligiblePages,
  now: () => number = Date.now,
  ttlMs = ELIGIBILITY_TTL_MS,
  maxStaleMs = ELIGIBILITY_MAX_STALE_MS,
) {
  let snapshot: EligibilitySnapshot | undefined;
  let inflight: Promise<EligibilitySnapshot> | undefined;

  async function refresh() {
    const pages = (await load()).filter((page) => readEligibility(page).eligible);
    const next: EligibilitySnapshot = {
      ids: new Set(pages.map((page) => page.id)),
      ratings: new Map(pages.map((page) => [page.id, readEligibility(page).rating as number])),
      pages,
      checkedAt: now(),
    };
    snapshot = next;
    return next;
  }

  return async function current(): Promise<EligibilitySnapshot> {
    if (snapshot && now() - snapshot.checkedAt < ttlMs) return snapshot;
    inflight ??= refresh().finally(() => {
      inflight = undefined;
    });
    try {
      return await inflight;
    } catch {
      if (snapshot && now() - snapshot.checkedAt <= maxStaleMs) return snapshot;
      throw new EligibilityUnavailableError();
    }
  };
}

const shared = globalThis as unknown as { __blackbookEligibility?: ReturnType<typeof createEligibilityChecker> };
export const currentEligibility = () => (shared.__blackbookEligibility ??= createEligibilityChecker())();
