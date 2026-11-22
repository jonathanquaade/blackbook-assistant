import { currentEligibility, type EligibilitySnapshot } from "./eligibility";
import { queryEligiblePages } from "./notion";
import { usesBundledIndex } from "./paths";
import { readEligibility, type NotionPage } from "./projection";
import { readStatus } from "./status";

interface Signed {
  url: string;
  expires: number;
}
const key = (pageId: string, file: string) => `${pageId}/${file}`;

function signedFiles(pages: NotionPage[]) {
  const files = new Map<string, Signed>();
  for (const page of pages) {
    if (!readEligibility(page).eligible) continue;
    const images = page.properties["Images"];
    const list = (images?.files as { name: string; type: string; file?: { url: string; expiry_time: string } }[] | undefined) ?? [];
    for (const item of list)
      if (item.type === "file" && item.file)
        files.set(key(page.id, item.name), { url: item.file.url, expires: Date.parse(item.file.expiry_time) });
  }
  return files;
}

const loadFiles = async (loadPages: () => Promise<NotionPage[]>) => signedFiles(await loadPages());

export function createMediaLookup(
  loadPages: () => Promise<NotionPage[]>,
  generation: () => string | undefined,
  now = Date.now,
) {
  let cache: { generation: string; at: number; files: Promise<Map<string, Signed>> } | undefined;
  return async (pageId: string, file: string) => {
    for (let attempt = 0; attempt < 2; attempt++) {
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
      if (current !== generation()) continue;
      return signed && signed.expires - now() > 5 * 60_000 ? signed.url : null;
    }
    return null;
  };
}

const localLookup = createMediaLookup(queryEligiblePages, () => readStatus().lastGood?.dir);

const byCheck = new WeakMap<EligibilitySnapshot, Map<string, Signed>>();
/** Serverless path: signed links come from the same fresh eligibility check that gates search. */
async function bundledLookup(pageId: string, file: string) {
  const snapshot = await currentEligibility();
  let files = byCheck.get(snapshot);
  if (!files) byCheck.set(snapshot, (files = signedFiles(snapshot.pages)));
  const signed = files.get(key(pageId, file));
  return signed && signed.expires - Date.now() > 5 * 60_000 ? signed.url : null;
}

export const signedImageUrl = (pageId: string, file: string) =>
  usesBundledIndex() ? bundledLookup(pageId, file) : localLookup(pageId, file);
