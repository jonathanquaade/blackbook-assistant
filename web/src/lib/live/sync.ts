/**
 * Read-only Notion projection into the local Postgres (PGlite + pgvector) search index.
 *   npm run sync                      # live Notion read, needs NOTION_API_KEY
 *   npm run sync -- --from-backup     # offline, from ../backups/latest-raw.json
 * A failed sync never replaces the last good index.
 */
import fs from "node:fs";
import path from "node:path";
import { embedPassages } from "./embed";
import { pageTitle, queryEligiblePages, retrievePage } from "./notion";
import { dataDir, repoRoot } from "./paths";
import { mergeDuplicates, projectPage, readEligibility, worksAtIds, type ManifestItem, type NotionPage } from "./projection";
import { cachedVectors, createDb, pendingInputs, readStatus, withIndex, writeEntries, writeStatus, writeVectors } from "./store";

function manifestFor(pageId: string): ManifestItem[] {
  try {
    return JSON.parse(fs.readFileSync(path.join(repoRoot(), "assets", pageId, "manifest.json"), "utf8"));
  } catch {
    return [];
  }
}

export async function syncIndex(fromBackup = false) {
  const source = fromBackup ? "backup:backups/latest-raw.json" : "notion";
  const startedAt = new Date().toISOString();
  const status = readStatus();
  try {
    const pages: NotionPage[] = fromBackup
      ? JSON.parse(fs.readFileSync(path.join(repoRoot(), "backups", "latest-raw.json"), "utf8")).rows
      : await queryEligiblePages();
    const eligible = pages.filter((page) => readEligibility(page).eligible);
    const byId = new Map(pages.map((page) => [page.id, page]));
    const relationNames: Record<string, string> = {};
    for (const id of new Set(eligible.flatMap(worksAtIds))) {
      const page = byId.get(id) ?? (fromBackup ? undefined : await retrievePage(id).catch(() => undefined));
      if (page) relationNames[id] = pageTitle(page);
    }
    const entries = mergeDuplicates(eligible.map((page) => projectPage(page, manifestFor(page.id), relationNames)));

    const dir = path.join(dataDir(), "index", startedAt.replace(/[:.]/g, "-"));
    fs.mkdirSync(path.dirname(dir), { recursive: true });
    const cache = (await withIndex(cachedVectors)) ?? new Map<string, number[]>();

    const inputs = pendingInputs(entries);
    const missing = inputs.filter((input) => !cache.has(input.hash));
    const fresh = missing.length ? await embedPassages(missing.map((input) => input.text)) : [];
    missing.forEach((input, index) => cache.set(input.hash, fresh[index]));

    const db = await createDb(dir);
    const counts = { fetched: pages.length, eligible: eligible.length, merged: entries.length, embedded: missing.length, reused: inputs.length - missing.length };
    try {
      await writeEntries(db, entries);
      await writeVectors(db, inputs.map((input) => ({ entryId: input.entryId, projectIdx: input.projectIdx, hash: input.hash, embedding: cache.get(input.hash)! })));
      await db.query("insert into sync_runs (started_at, finished_at, source, ok, counts) values ($1, now(), $2, true, $3)", [startedAt, source, JSON.stringify(counts)]);
    } finally {
      await db.close();
    }

    const finishedAt = new Date().toISOString();
    writeStatus({
      lastAttempt: { at: finishedAt, ok: true, source },
      lastGood: { at: finishedAt, source, dir, eligible: counts.eligible, merged: counts.merged, embedded: counts.embedded, reused: counts.reused },
    });
    const indexRoot = path.dirname(dir);
    const keep = new Set([dir, status.lastGood?.dir]);
    for (const name of fs.readdirSync(indexRoot)) {
      const full = path.join(indexRoot, name);
      if (!keep.has(full)) {
        try {
          fs.rmSync(full, { recursive: true, force: true });
        } catch {
          console.warn("Could not remove an old Blackbook index.");
        }
      }
    }
    console.log(`Synced ${counts.merged} searchable entries (${counts.eligible} eligible pages; ${counts.embedded} new embeddings, ${counts.reused} reused) from ${source}.`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    writeStatus({ ...status, lastAttempt: { at: new Date().toISOString(), ok: false, source, error: message } });
    console.error(`Sync failed; keeping the last good index. ${message}`);
    throw error;
  }
}
