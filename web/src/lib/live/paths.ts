import fs from "node:fs";
import os from "node:os";
import path from "node:path";

/** Persistent state for the self-hosted path. On Vercel only the temp dir is writable. */
export function dataDir() {
  return (
    process.env.BLACKBOOK_DATA_DIR ??
    (process.env.VERCEL ? path.join(os.tmpdir(), "blackbook-data") : path.join(process.cwd(), ".data"))
  );
}
export const repoRoot = () =>
  process.env.BLACKBOOK_REPO_ROOT ?? path.resolve(process.cwd(), "..");

/** Build-time index, bundled into the deployment. Generated, gitignored, never committed. */
export const bundleDir = () => process.env.BLACKBOOK_INDEX_DIR ?? path.join(process.cwd(), ".blackbook-index");

/** True when search runs from the bundled index plus a fresh eligibility check (Vercel, or opted in). */
export const usesBundledIndex = () => Boolean(process.env.VERCEL) || process.env.BLACKBOOK_INDEX_MODE === "bundle";

/**
 * Where the embedding model is cached. An explicit override wins (the build sets it to the bundle);
 * then a model bundled with the deployment (read-only is fine); then temp on Vercel; else .data.
 */
export function modelCacheDir() {
  if (process.env.BLACKBOOK_MODEL_DIR) return process.env.BLACKBOOK_MODEL_DIR;
  const bundled = path.join(bundleDir(), "models");
  if (fs.existsSync(bundled)) return bundled;
  return process.env.VERCEL ? path.join(os.tmpdir(), "blackbook-models") : path.join(dataDir(), "models");
}
