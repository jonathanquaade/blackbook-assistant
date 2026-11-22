import { parseLiveBrief } from "./brief";
import type { IndexedEntry } from "./projection";
import { shapeResults, type EntryRow, type LiveFilters } from "./search";

/** One entry of the bundled index: the allow-listed projection plus its passage vectors. */
export interface BundledEntry extends IndexedEntry {
  vectors: { projectIdx: number | null; embedding: number[] }[];
}

const normalize = (value: string) =>
  value.toLowerCase().normalize("NFKD").replace(/\p{M}/gu, "").replace(/[^a-z0-9]+/g, " ").trim();

/** Light stemmer so "packaging" meets "package" and "designers" meets "designer". */
const stem = (word: string) => {
  const base = word.length > 4 ? word.replace(/(ings?|ers?|ed|es|s)$/, "") : word;
  return base.length > 3 ? base.replace(/e$/, "") : base;
};
const tokens = (value: string) => normalize(value).split(" ").filter(Boolean).map(stem);

/** Field weights mirror the Postgres index: name A, role B, project captions C, locations D. */
const WEIGHTS = { name: 1, role: 0.4, captions: 0.2, locations: 0.1 };

const hits = (haystack: string[], term: string) => haystack.some((word) => word === term || (term.length >= 2 && word.startsWith(term)));
const queryTerms = (terms: string[]) => [...new Set(terms.map((term) => stem(normalize(term))).filter((term) => term.length > 1))];

export const cosine = (a: number[], b: number[]) => {
  let sum = 0;
  for (let i = 0; i < a.length; i++) sum += a[i] * b[i];
  return sum;
};

/**
 * Keyword plus vector search over in-memory entries. Callers pass only entries that are currently
 * eligible; this also re-checks Verified and rating 4 or 5 on every entry, whatever it is given.
 */
export function searchEntries(
  all: BundledEntry[],
  options: { query: string; filters?: LiveFilters; muted?: string[]; ids?: string[]; queryVector?: number[] | null },
) {
  const brief = parseLiveBrief(options.query, options.muted);
  const filters = options.filters ?? {};
  const ids = options.ids;
  const entries = all
    .filter(
      (entry) =>
        entry.status === "Verified" && (entry.rating === 4 || entry.rating === 5) &&
        (!brief.freelance || entry.workStatus === "Freelance") &&
        (!brief.types.length || brief.types.includes(entry.type)) &&
        (!brief.locations.length || entry.locations.some((location) => brief.locations.includes(location))) &&
        (!filters.capability || entry.capabilities.includes(filters.capability)) &&
        (!filters.workStatus || entry.workStatus === filters.workStatus) &&
        (!filters.type || entry.type === filters.type) &&
        (!ids || ids.includes(entry.id) || entry.pageIds.some((id) => ids.includes(id))),
    )
    .sort((a, b) => a.name.localeCompare(b.name));
  const byId = new Map(entries.map((entry) => [entry.id, entry]));
  const terms = queryTerms(brief.terms);

  const scored = terms.length
    ? entries.flatMap((entry) => {
        const fields = {
          name: tokens(entry.name),
          role: tokens([entry.type, ...entry.capabilities, entry.employer ?? ""].join(" ")),
          captions: tokens(entry.projects.filter((project) => !project.contextShot).map((project) => project.caption ?? "").join(" ")),
          locations: tokens(entry.locations.join(" ")),
        };
        let score = 0;
        let matched = 0;
        for (const term of terms) {
          const best = (Object.keys(WEIGHTS) as (keyof typeof WEIGHTS)[]).filter((field) => hits(fields[field], term)).map((field) => WEIGHTS[field]);
          if (best.length) {
            matched++;
            score += Math.max(...best) + 0.1 * best.length;
          }
        }
        return matched ? [{ id: entry.id, score }] : [];
      })
    : [];
  scored.sort((a, b) => b.score - a.score || byId.get(a.id)!.name.localeCompare(byId.get(b.id)!.name));

  const keywordProject = new Map<string, number>();
  if (terms.length)
    for (const entry of entries) {
      let best = { idx: -1, score: 0 };
      for (const project of entry.projects) {
        if (project.contextShot || !project.caption) continue;
        const words = tokens(project.caption);
        const score = terms.filter((term) => hits(words, term)).length;
        if (score > best.score) best = { idx: project.idx, score };
      }
      if (best.idx >= 0) keywordProject.set(entry.id, best.idx);
    }

  const vector =
    options.queryVector && terms.length
      ? entries
          .flatMap((entry) => {
            let best: { entryId: string; projectIdx: number | null; similarity: number } | null = null;
            for (const item of entry.vectors) {
              const similarity = cosine(options.queryVector!, item.embedding);
              if (!best || similarity > best.similarity) best = { entryId: entry.id, projectIdx: item.projectIdx, similarity };
            }
            return best ? [best] : [];
          })
          .sort((a, b) => b.similarity - a.similarity)
      : [];

  const rows: EntryRow[] = entries.map((entry) => ({
    id: entry.id,
    page_ids: entry.pageIds,
    name: entry.name,
    type: entry.type,
    capabilities: entry.capabilities,
    work_status: entry.workStatus,
    locations: entry.locations,
    employer: entry.employer,
    rating: entry.rating,
  }));
  return shapeResults({
    brief,
    query: options.query,
    entries: rows,
    projectsOf: (id) => byId.get(id)?.projects ?? [],
    keyword: scored.map((row) => row.id),
    keywordProject,
    vector,
  });
}
