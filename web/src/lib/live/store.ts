import fs from "node:fs";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { vector } from "@electric-sql/pglite-pgvector";
import { EMBEDDING_MODEL } from "./model";
import { dataDir } from "./paths";
import { embeddingInputs, type IndexedEntry } from "./projection";

export const SCHEMA = `
create extension if not exists vector;
create table if not exists entries (
  id text primary key,
  page_ids text[] not null,
  name text not null,
  type text not null,
  capabilities text[] not null,
  work_status text not null,
  locations text[] not null,
  employer text,
  status text not null,
  rating int,
  last_edited timestamptz,
  doc tsvector not null
);
create table if not exists projects (
  entry_id text not null references entries(id) on delete cascade,
  idx int not null,
  caption text,
  link text,
  media jsonb not null,
  images jsonb not null,
  context_shot boolean not null,
  primary key (entry_id, idx)
);
create table if not exists vectors (
  entry_id text not null references entries(id) on delete cascade,
  project_idx int,
  content_hash text not null,
  model text not null,
  embedding vector(${EMBEDDING_MODEL.dims}) not null
);
create table if not exists sync_runs (
  id serial primary key,
  started_at timestamptz not null,
  finished_at timestamptz,
  source text not null,
  ok boolean not null,
  counts jsonb,
  error text
);`;

export async function createDb(dir?: string) {
  const db = await PGlite.create({ dataDir: dir, extensions: { vector } });
  await db.exec(SCHEMA);
  return db;
}

export async function writeEntries(db: PGlite, entries: IndexedEntry[]) {
  for (const entry of entries) {
    const captions = entry.projects.filter((project) => !project.contextShot).map((project) => project.caption ?? "").join(" ");
    await db.query(
      `insert into entries values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,
        setweight(to_tsvector('english', $3), 'A') ||
        setweight(to_tsvector('english', $4 || ' ' || array_to_string($5::text[], ' ') || ' ' || coalesce($8, '')), 'B') ||
        setweight(to_tsvector('english', $12), 'C') ||
        setweight(to_tsvector('english', array_to_string($7::text[], ' ')), 'D'))`,
      [entry.id, entry.pageIds, entry.name, entry.type, entry.capabilities, entry.workStatus, entry.locations, entry.employer, entry.status, entry.rating, entry.lastEdited, captions],
    );
    for (const project of entry.projects)
      await db.query("insert into projects values ($1,$2,$3,$4,$5,$6,$7)", [entry.id, project.idx, project.caption, project.link, JSON.stringify(project.media), JSON.stringify(project.images), project.contextShot]);
  }
}

export interface VectorRow {
  entryId: string;
  projectIdx: number | null;
  hash: string;
  embedding: number[];
}
export async function writeVectors(db: PGlite, rows: VectorRow[]) {
  for (const row of rows)
    await db.query("insert into vectors values ($1,$2,$3,$4,$5)", [row.entryId, row.projectIdx, row.hash, EMBEDDING_MODEL.version, JSON.stringify(row.embedding)]);
}

/** Vectors already computed for identical content with the same model, keyed by content hash. */
export async function cachedVectors(db: PGlite | null) {
  const cache = new Map<string, number[]>();
  if (!db) return cache;
  const { rows } = await db.query<{ content_hash: string; embedding: string }>(
    "select content_hash, embedding::text from vectors where model = $1",
    [EMBEDDING_MODEL.version],
  );
  for (const row of rows) cache.set(row.content_hash, JSON.parse(row.embedding));
  return cache;
}

export const pendingInputs = (entries: IndexedEntry[]) =>
  entries.flatMap((entry) => embeddingInputs(entry).map((input) => ({ ...input, entryId: entry.id })));

// ---- index pointer and last-good sync status ----

export interface SyncStatus {
  lastAttempt?: { at: string; ok: boolean; source: string; error?: string };
  lastGood?: { at: string; source: string; dir: string; eligible: number; merged: number; embedded: number; reused: number };
}
const statusFile = () => path.join(dataDir(), "sync-status.json");
export function readStatus(): SyncStatus {
  try {
    return JSON.parse(fs.readFileSync(statusFile(), "utf8"));
  } catch {
    return {};
  }
}
export function writeStatus(status: SyncStatus) {
  fs.mkdirSync(dataDir(), { recursive: true });
  fs.writeFileSync(`${statusFile()}.tmp`, JSON.stringify(status, null, 2));
  fs.renameSync(`${statusFile()}.tmp`, statusFile());
}

interface Snapshot {
  dir: string;
  db: Promise<PGlite>;
  readers: number;
  retired?: boolean;
}
const cache = globalThis as unknown as { __blackbookIndex?: Snapshot };

/** The last good index, reopened when a newer sync lands. Null until the first sync succeeds. */
export async function withIndex<T>(read: (db: PGlite) => Promise<T>) {
  const dir = readStatus().lastGood?.dir;
  if (!dir || !fs.existsSync(dir)) return null;
  if (cache.__blackbookIndex?.dir !== dir) {
    const previous = cache.__blackbookIndex;
    cache.__blackbookIndex = { dir, db: PGlite.create({ dataDir: dir, extensions: { vector } }), readers: 0 };
    if (previous) {
      previous.retired = true;
      if (!previous.readers) closeSnapshot(previous);
    }
  }
  const snapshot = cache.__blackbookIndex;
  snapshot.readers++;
  try {
    return await read(await snapshot.db);
  } finally {
    snapshot.readers--;
    if (snapshot.retired && !snapshot.readers) closeSnapshot(snapshot);
  }
}

function closeSnapshot(snapshot: Snapshot) {
  snapshot.db.then((db) => db.close()).catch(() => {});
}
