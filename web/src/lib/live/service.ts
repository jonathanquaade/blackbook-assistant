import { embedQuery } from "./embed";
import { parseLiveBrief } from "./brief";
import { searchIndex, type LiveFilters } from "./search";
import { withIndex } from "./store";

export interface SearchRequest {
  query: string;
  filters?: LiveFilters;
  muted?: string[];
  ids?: string[];
  mode?: "hybrid" | "keyword";
}

export async function runSearch(request: SearchRequest) {
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
  return response && { mode, brief, results: response.results, ms: Math.round(performance.now() - started) };
}
