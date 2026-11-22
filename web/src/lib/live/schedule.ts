import { liveSetting } from "./config";
import { syncIndex } from "./sync";

const state = globalThis as unknown as { __blackbookSyncScheduled?: boolean };

export function startScheduledSync() {
  if (state.__blackbookSyncScheduled) return;
  if (!liveSetting("NOTION_API_KEY") || !liveSetting("BLACKBOOK_OWNER_PASSWORD"))
    throw new Error("Live Explore requires NOTION_API_KEY and BLACKBOOK_OWNER_PASSWORD.");
  const minutes = Number(liveSetting("BLACKBOOK_SYNC_MINUTES") ?? 15);
  if (!Number.isSafeInteger(minutes) || minutes < 1 || minutes > 1440)
    throw new Error("BLACKBOOK_SYNC_MINUTES must be a whole number between 1 and 1440.");
  state.__blackbookSyncScheduled = true;

  async function refresh() {
    try {
      await syncIndex();
    } catch {
      // syncIndex records the failure and retains the last good snapshot.
    } finally {
      setTimeout(() => void refresh(), minutes * 60_000).unref();
    }
  }
  setTimeout(() => void refresh(), 0).unref();
}
