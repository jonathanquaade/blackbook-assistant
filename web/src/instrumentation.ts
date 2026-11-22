export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs" && process.env.BLACKBOOK_AUTO_SYNC === "1") {
    const { startScheduledSync } = await import("./lib/live/schedule");
    startScheduledSync();
  }
}
