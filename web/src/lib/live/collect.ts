import fs from "node:fs";
import path from "node:path";
import { queryEligiblePages } from "./notion";
import { repoRoot } from "./paths";
import { mergeDuplicates, pageTitleOf, projectPage, readEligibility, worksAtIds, type IndexedEntry, type ManifestItem, type NotionPage } from "./projection";

function manifestFor(pageId: string): ManifestItem[] {
  try {
    return JSON.parse(fs.readFileSync(path.join(repoRoot(), "assets", pageId, "manifest.json"), "utf8"));
  } catch {
    return [];
  }
}

/**
 * Read-only: Notion (or the offline backup) to projected, merged, eligible entries.
 * The shared front half of the local sync and the Vercel build-time index.
 * Employer names come only from employer pages that pass eligibility themselves; an employer that
 * is not Verified and rated 4 or 5 is shown as its Works At Link host instead.
 */
export async function collectEntries(fromBackup = false) {
  const source = fromBackup ? "backup:backups/latest-raw.json" : "notion";
  const pages: NotionPage[] = fromBackup
    ? JSON.parse(fs.readFileSync(path.join(repoRoot(), "backups", "latest-raw.json"), "utf8")).rows
    : await queryEligiblePages();
  const eligible = pages.filter((page) => readEligibility(page).eligible);
  const byId = new Map(eligible.map((page) => [page.id, page]));
  const relationNames: Record<string, string> = {};
  for (const id of new Set(eligible.flatMap(worksAtIds))) {
    const employer = byId.get(id);
    if (employer) relationNames[id] = pageTitleOf(employer);
  }
  const entries: IndexedEntry[] = mergeDuplicates(eligible.map((page) => projectPage(page, manifestFor(page.id), relationNames)));
  return { source, fetched: pages.length, eligible: eligible.length, entries };
}
