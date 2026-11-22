import { writeBundle, type BundledIndex } from "./bundle";
import { collectEntries } from "./collect";
import { embedPassages } from "./embed";
import type { BundledEntry } from "./memory-search";
import { EMBEDDING_MODEL } from "./model";
import { embeddingInputs, type IndexedEntry } from "./projection";

/** Explicit allow-list: nothing outside these fields can reach the bundled file. */
export function toBundledEntry(entry: IndexedEntry, vectors: BundledEntry["vectors"]): BundledEntry {
  return {
    id: entry.id,
    pageIds: entry.pageIds,
    name: entry.name,
    type: entry.type,
    capabilities: entry.capabilities,
    workStatus: entry.workStatus,
    locations: entry.locations,
    employer: entry.employer,
    employerId: entry.employerId ?? null,
    employerFallback: entry.employerFallback ?? null,
    status: entry.status,
    rating: entry.rating,
    lastEdited: entry.lastEdited,
    projects: entry.projects.map((project) => ({
      idx: project.idx,
      caption: project.caption,
      link: project.link,
      media: project.media,
      images: project.images,
      contextShot: project.contextShot,
    })),
    vectors,
  };
}

/**
 * Read-only Notion (or backup) to the bundled index file. If the local model cannot run, the index
 * is still written without vectors and search runs keyword-only; it never falls back to fixtures.
 */
export async function buildBundle(fromBackup = false) {
  const collected = await collectEntries(fromBackup);
  const inputs = collected.entries.flatMap((entry) => embeddingInputs(entry).map((input) => ({ ...input, entryId: entry.id })));
  let vectors: number[][] | null = null;
  try {
    vectors = inputs.length ? await embedPassages(inputs.map((input) => input.text)) : [];
  } catch (error) {
    console.warn(`Embeddings unavailable at build, index will be keyword-only: ${error instanceof Error ? error.message : "unknown error"}`);
  }
  const round = (vector: number[]) => vector.map((value) => Math.round(value * 1e5) / 1e5);
  const entries = collected.entries.map((entry) =>
    toBundledEntry(
      entry,
      vectors
        ? inputs.flatMap((input, i) => (input.entryId === entry.id ? [{ projectIdx: input.projectIdx, embedding: round(vectors[i]) }] : []))
        : [],
    ),
  );
  const index: BundledIndex = {
    version: 1,
    builtAt: new Date().toISOString(),
    source: collected.source,
    model: EMBEDDING_MODEL.version,
    hasVectors: vectors !== null,
    entries,
  };
  writeBundle(index);
  return { index, fetched: collected.fetched, eligible: collected.eligible };
}
