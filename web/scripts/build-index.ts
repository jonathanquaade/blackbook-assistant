/**
 * Vercel prebuild: read Notion (read-only), embed locally, write .blackbook-index/index.json.
 * Skips (exit 0) only when live mode is not configured, so a build without the environment variables
 * ships live mode disabled, never fixtures posing as live data. Once live mode is configured, a failed
 * index build exits non-zero so Vercel keeps the previous deployment (a Notion outage during an hourly
 * redeploy must not replace a working production deploy with one that 503s every search). A failed
 * embedding is not a failure: buildBundle falls back to a keyword-only index.
 * Runs on Vercel (VERCEL=1) or when BLACKBOOK_BUILD_INDEX=1; `--from-backup` reads ../backups.
 */
import path from "node:path";
import { ownerPassword } from "../src/lib/live/auth";
import { bundleDir } from "../src/lib/live/paths";

async function main() {
  const fromBackup = process.argv.includes("--from-backup");
  if (!process.env.VERCEL && process.env.BLACKBOOK_BUILD_INDEX !== "1") return console.log("Index build skipped (not on Vercel).");
  const { liveSetting } = await import("../src/lib/live/config");
  if (!ownerPassword()) return console.log("Index build skipped: live mode disabled (BLACKBOOK_OWNER_PASSWORD missing or under 12 characters).");
  if (!fromBackup && !liveSetting("NOTION_API_KEY")) return console.log("Index build skipped: NOTION_API_KEY is not set. Live mode will report no index.");
  process.env.BLACKBOOK_MODEL_DIR ??= path.join(bundleDir(), "models");
  const { buildBundle } = await import("../src/lib/live/build-bundle");
  const { index, fetched, eligible } = await buildBundle(fromBackup);
  console.log(`Index built: ${index.entries.length} entries (${eligible} eligible of ${fetched} pages), ${index.hasVectors ? "with" : "WITHOUT"} vectors.`);
}

main().then(
  () => process.exit(0),
  (error) => {
    // Notion messages are status codes only; never print payloads.
    console.error(`Index build failed, aborting the deploy: ${error instanceof Error ? error.message : "unknown error"}`);
    process.exit(1);
  },
);
