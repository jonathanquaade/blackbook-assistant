import { queryEligiblePages } from "./notion";
import { readEligibility, type NotionPage } from "./projection";
import { readStatus } from "./store";

interface Signed {
  url: string;
  expires: number;
}
const key = (pageId: string, file: string) => `${pageId}/${file}`;

async function loadFiles(loadPages: () => Promise<NotionPage[]>) {
  const files = new Map<string, Signed>();
  for (const page of await loadPages()) {
    if (!readEligibility(page).eligible) continue;
    const images = page.properties["Images"];
    const list = (images?.files as { name: string; type: string; file?: { url: string; expiry_time: string } }[] | undefined) ?? [];
    for (const item of list)
      if (item.type === "file" && item.file)
        files.set(key(page.id, item.name), { url: item.file.url, expires: Date.parse(item.file.expiry_time) });
  }
  return files;
}

export function createMediaLookup(
  loadPages: () => Promise<NotionPage[]>,
  generation: () => string | undefined,
  now = Date.now,
) {
  let cache: { generation: string; at: number; files: Promise<Map<string, Signed>> } | undefined;
  return async (pageId: string, file: string) => {
    const current = generation();
    if (!current) return null;
    if (cache?.generation !== current || now() - cache.at >= 60_000) {
      const snapshot = { generation: current, at: now(), files: loadFiles(loadPages) };
      cache = snapshot;
      void snapshot.files.catch(() => {
        if (cache === snapshot) cache = undefined;
      });
    }
    const signed = (await cache.files).get(key(pageId, file));
    if (current !== generation()) return null;
    return signed && signed.expires - now() > 5 * 60_000 ? signed.url : null;
  };
}

export const signedImageUrl = createMediaLookup(queryEligiblePages, () => readStatus().lastGood?.dir);
