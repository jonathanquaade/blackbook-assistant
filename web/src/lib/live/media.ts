import { queryEligiblePages } from "./notion";
import { readEligibility } from "./projection";

interface Signed {
  url: string;
  expires: number;
}
const state = globalThis as unknown as {
  __blackbookMedia?: { fetchedAt: number; files: Map<string, Signed> };
  __blackbookMediaPending?: Promise<void>;
};
const key = (pageId: string, file: string) => `${pageId}/${file}`;

async function refresh() {
  const files = new Map<string, Signed>();
  for (const page of await queryEligiblePages()) {
    if (!readEligibility(page).eligible) continue;
    const images = page.properties["Images"];
    const list = (images?.files as { name: string; type: string; file?: { url: string; expiry_time: string } }[] | undefined) ?? [];
    for (const item of list)
      if (item.type === "file" && item.file)
        files.set(key(page.id, item.name), { url: item.file.url, expires: Date.parse(item.file.expiry_time) });
  }
  state.__blackbookMedia = { fetchedAt: Date.now(), files };
}

/**
 * A fresh signed Notion URL for an image on an eligible entry, or null.
 * Signed URLs expire after about an hour, so they are re-read from Notion, never stored.
 */
export async function signedImageUrl(pageId: string, file: string) {
  const fresh = (signed?: Signed) => signed && signed.expires - Date.now() > 5 * 60_000;
  const cached = state.__blackbookMedia;
  const hit = cached?.files.get(key(pageId, file));
  if (fresh(hit)) return hit!.url;
  if (hit || !cached || Date.now() - cached.fetchedAt > 60_000) {
    state.__blackbookMediaPending ??= refresh().finally(() => {
      state.__blackbookMediaPending = undefined;
    });
    await state.__blackbookMediaPending;
  }
  const next = state.__blackbookMedia?.files.get(key(pageId, file));
  return fresh(next) ? next!.url : null;
}
