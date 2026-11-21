/**
 * Read-only Notion projection into the local Postgres (PGlite + pgvector) search index.
 *   npm run sync                      # live Notion read, needs NOTION_API_KEY
 *   npm run sync -- --from-backup     # offline, from ../backups/latest-raw.json
 * A failed sync never replaces the last good index.
 */
import fs from "node:fs";
import path from "node:path";
import type { PGlite } from "@electric-sql/pglite";
import { embedPassages } from "../src/lib/live/embed";
import { pageTitle, queryEligiblePages, retrievePage } from "../src/lib/live/notion";
import { dataDir, repoRoot } from "../src/lib/live/paths";
import { mergeDuplicates, projectPage, readEligibility, worksAtIds, type ManifestItem, type NotionPage } from "../src/lib/live/projection";
import { cachedVectors, createDb, pendingInputs, readStatus, writeEntries, writeStatus, writeVectors } from "../src/lib/live/store";
import { PGlite as PG } from "@electric-sql/pglite";
import { vector } from "@electric-sql/pglite-pgvector";

const fromBackup = process.argv.includes("--from-backup");
const source = fromBackup ? "backup:backups/latest-raw.json" : "notion";

function manifestFor(pageId: string): ManifestItem[] {
  try {
    return JSON.parse(fs.readFileSync(path.join(repoRoot(), "assets", pageId, "manifest.json"), "utf8"));
  } catch {
    return [];
  }
}

async function main() {
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
    let previous: PGlite | null = null;
    if (status.lastGood?.dir && fs.existsSync(status.lastGood.dir))
      previous = await PG.create({ dataDir: status.lastGood.dir, extensions: { vector } });
    const cache = await cachedVectors(previous);
    await previous?.close();

    const inputs = pendingInputs(entries);
    const missing = inputs.filter((input) => !cache.has(input.hash));
    const fresh = missing.length ? await embedPassages(missing.map((input) => input.text)) : [];
    missing.forEach((input, index) => cache.set(input.hash, fresh[index]));

    const db = await createDb(dir);
    await writeEntries(db, entries);
    await writeVectors(db, inputs.map((input) => ({ entryId: input.entryId, projectIdx: input.projectIdx, hash: input.hash, embedding: cache.get(input.hash)! })));
    const counts = { fetched: pages.length, eligible: eligible.length, merged: entries.length, embedded: missing.length, reused: inputs.length - missing.length };
    await db.query("insert into sync_runs (started_at, finished_at, source, ok, counts) values ($1, now(), $2, true, $3)", [startedAt, source, JSON.stringify(counts)]);
    await db.close();

    const finishedAt = new Date().toISOString();
    writeStatus({
      lastAttempt: { at: finishedAt, ok: true, source },
      lastGood: { at: finishedAt, source, dir, eligible: counts.eligible, merged: counts.merged, embedded: counts.embedded, reused: counts.reused },
    });
    const indexRoot = path.dirname(dir);
    const keep = new Set([dir, status.lastGood?.dir]);
    for (const name of fs.readdirSync(indexRoot)) {
      const full = path.join(indexRoot, name);
      if (!keep.has(full)) fs.rmSync(full, { recursive: true, force: true });
    }
    console.log(`Synced ${counts.merged} searchable entries (${counts.eligible} eligible pages; ${counts.embedded} new embeddings, ${counts.reused} reused) from ${source}.`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    writeStatus({ ...status, lastAttempt: { at: new Date().toISOString(), ok: false, source, error: message } });
    console.error(`Sync failed; keeping the last good index. ${message}`);
    process.exitCode = 1;
  }
}

main().then(() => process.exit(process.exitCode ?? 0));
