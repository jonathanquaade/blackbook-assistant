import type { PGlite } from "@electric-sql/pglite";
import { parseLiveBrief, type LiveBrief, reciprocalRankFusion, toTsQuery } from "./brief";
import { roleLine, type IndexedImage, type IndexedProject } from "./projection";

/** bge-small cosine similarity cut-offs, calibrated on the benchmark briefs (blackbook/stage1-eval.md). */
export const STRONG_SIMILARITY = 0.68;
export const MIN_SIMILARITY = 0.64;

export interface LiveFilters {
  capability?: string | null;
  workStatus?: string | null;
  type?: string | null;
}
export type LiveProject = Omit<IndexedProject, "idx">;
export interface LiveResult {
  id: string;
  pageIds: string[];
  name: string;
  role: string;
  type: string;
  capabilities: string[];
  workStatus: string;
  locations: string[];
  employer: string | null;
  rating: number | null;
  projects: LiveProject[];
  tier: "strong" | "weak";
  score: number;
  similarity: number | null;
  matchedTerms: string[];
  missingTerms: string[];
  reason: string | null;
}

export interface EntryRow {
  id: string;
  page_ids: string[];
  name: string;
  type: string;
  capabilities: string[];
  work_status: string;
  locations: string[];
  employer: string | null;
  rating: number | null;
}

const normalize = (value: string) =>
  value.toLowerCase().normalize("NFKD").replace(/\p{M}/gu, "").replace(/[^a-z0-9]+/g, " ").trim();

export async function searchIndex(
  db: PGlite,
  options: { query: string; filters?: LiveFilters; muted?: string[]; ids?: string[]; queryVector?: number[] | null },
) {
  const brief = parseLiveBrief(options.query, options.muted);
  const filters = options.filters ?? {};
  // Eligibility is enforced again here, whatever the index holds.
  const { rows: entries } = await db.query<EntryRow>(
    `select id, page_ids, name, type, capabilities, work_status, locations, employer, rating from entries
     where status = 'Verified' and rating in (4, 5)
       and ($1::boolean is false or work_status = 'Freelance')
       and (cardinality($2::text[]) = 0 or type = any($2::text[]))
       and (cardinality($3::text[]) = 0 or locations && $3::text[])
       and ($4::text is null or $4 = any(capabilities))
       and ($5::text is null or work_status = $5)
       and ($6::text is null or type = $6)
       and ($7::text[] is null or id = any($7::text[]) or page_ids && $7::text[])
     order by name`,
    [brief.freelance, brief.types, brief.locations, filters.capability ?? null, filters.workStatus ?? null, filters.type ?? null, options.ids ?? null],
  );
  const ids = entries.map((entry) => entry.id);
  const { rows: projectRows } = await db.query<{ entry_id: string; idx: number; caption: string | null; link: string | null; media?: string[]; images: IndexedImage[]; context_shot: boolean }>(
    "select * from projects where entry_id = any($1::text[]) order by entry_id, context_shot, idx",
    [ids],
  );
  const tsQuery = toTsQuery(brief.terms);
  const keyword = tsQuery
    ? (
        await db.query<{ id: string; rank: number }>(
          `select id, ts_rank_cd(doc, q) as rank from entries, to_tsquery('english', $1) q
           where id = any($2::text[]) and doc @@ q order by rank desc, name`,
          [tsQuery, ids],
        )
      ).rows
    : [];
  const keywordProject = tsQuery
    ? (
        await db.query<{ entry_id: string; idx: number }>(
          `select distinct on (entry_id) entry_id, idx from projects, to_tsquery('english', $1) q
           where entry_id = any($2::text[]) and not context_shot and to_tsvector('english', coalesce(caption, '')) @@ q
           order by entry_id, ts_rank_cd(to_tsvector('english', coalesce(caption, '')), q) desc, idx`,
          [tsQuery, ids],
        )
      ).rows
    : [];
  const vector = options.queryVector && brief.terms.length
    ? (
        await db.query<{ entry_id: string; project_idx: number | null; similarity: number }>(
          `select distinct on (entry_id) entry_id, project_idx, 1 - (embedding <=> $1) as similarity
           from vectors where entry_id = any($2::text[]) order by entry_id, embedding <=> $1`,
          [JSON.stringify(options.queryVector), ids],
        )
      ).rows.sort((a, b) => b.similarity - a.similarity)
    : [];

  return shapeResults({
    brief,
    query: options.query,
    entries,
    projectsOf: (id) =>
      projectRows.filter((row) => row.entry_id === id).map((row) => ({
        idx: row.idx, caption: row.caption, link: row.link, media: row.media ?? [], images: row.images, contextShot: row.context_shot,
      })),
    keyword: keyword.map((row) => row.id),
    keywordProject: new Map(keywordProject.map((row) => [row.entry_id, row.idx])),
    vector: vector.map((row) => ({ entryId: row.entry_id, projectIdx: row.project_idx, similarity: row.similarity })),
  });
}

export interface RankedInputs {
  brief: LiveBrief;
  query: string;
  entries: EntryRow[];
  projectsOf: (id: string) => IndexedProject[];
  /** Entry ids ranked by keyword relevance, best first. */
  keyword: string[];
  /** Best keyword-matching project index per entry. */
  keywordProject: Map<string, number>;
  /** Best vector hit per entry, sorted by similarity descending. */
  vector: { entryId: string; projectIdx: number | null; similarity: number }[];
}

/** Fusion, tiers and reasons. Shared by the Postgres index and the bundled in-memory index. */
export function shapeResults({ brief, query, entries, projectsOf, keyword, keywordProject, vector }: RankedInputs) {
  const queryText = normalize(query);
  const nameHits = new Set(entries.filter((entry) => queryText && ` ${queryText} `.includes(` ${normalize(entry.name)} `)).map((entry) => entry.id));
  const vectorIds = vector.filter((row) => row.similarity >= MIN_SIMILARITY).map((row) => row.entryId);
  const fused = reciprocalRankFusion([keyword, vectorIds]);
  const hasQuery = brief.terms.length > 0;

  const results: LiveResult[] = entries.flatMap((entry) => {
    const projects = projectsOf(entry.id);
    const haystack = normalize([entry.name, entry.type, entry.employer ?? "", ...entry.capabilities, ...entry.locations, ...projects.map((project) => project.caption ?? "")].join(" ")).split(" ");
    const matchedTerms = brief.terms.filter((term) => haystack.some((word) => word === term || (term.length >= 4 && word.startsWith(term))));
    const best = vector.find((row) => row.entryId === entry.id);
    const isName = nameHits.has(entry.id);
    if (hasQuery && !isName && !fused.has(entry.id)) return [];
    const evidenceIdx = keywordProject.get(entry.id) ?? best?.projectIdx ?? null;
    const evidence = projects.find((project) => project.idx === evidenceIdx && project.caption);
    const capabilityHit = entry.capabilities.find((capability) => brief.terms.some((term) => normalize(capability).split(" ").some((word) => word.startsWith(term))));
    const reason = !hasQuery
      ? null
      : isName
        ? `Name · ${entry.name}`
        : evidence
          ? `Project · ${evidence.caption}`
          : capabilityHit
            ? `Capabilities · ${entry.capabilities.join(", ")}`
            : null;
    const similarity = best?.similarity ?? null;
    const coverage = matchedTerms.length >= 2 && matchedTerms.length * 2 >= brief.terms.length;
    const tier: LiveResult["tier"] = !hasQuery || isName || (similarity ?? 0) >= STRONG_SIMILARITY || coverage ? "strong" : "weak";
    return [{
      id: entry.id,
      pageIds: entry.page_ids,
      name: entry.name,
      role: roleLine(entry),
      type: entry.type,
      capabilities: entry.capabilities,
      workStatus: entry.work_status,
      locations: entry.locations,
      employer: entry.employer,
      rating: entry.rating,
      projects: projects.map(({ caption, link, media, images, contextShot }) => ({ caption, link, media, images, contextShot })),
      tier,
      score: hasQuery ? (isName ? 1 : 0) + (fused.get(entry.id) ?? 0) : (entry.rating ?? 0),
      similarity,
      matchedTerms,
      missingTerms: brief.terms.filter((term) => !matchedTerms.includes(term)),
      reason,
    }];
  });
  results.sort((a, b) => Number(b.tier === "strong") - Number(a.tier === "strong") || b.score - a.score || a.name.localeCompare(b.name));
  return { brief, results };
}
