export async function register() {
  // Vercel is serverless: no background loop. The index is built at deploy time instead.
  if (process.env.VERCEL) return;
  if (process.env.NEXT_RUNTIME === "nodejs" && process.env.BLACKBOOK_AUTO_SYNC === "1") {
    const { startScheduledSync } = await import("./lib/live/schedule");
    startScheduledSync();
  }
}
