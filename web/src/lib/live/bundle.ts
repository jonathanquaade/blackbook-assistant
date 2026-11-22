import fs from "node:fs";
import path from "node:path";
import type { BundledEntry } from "./memory-search";
import { EMBEDDING_MODEL } from "./model";
import { bundleDir } from "./paths";

/** The build-time index. Holds only the allow-listed projection and passage vectors. */
export interface BundledIndex {
  version: 1;
  builtAt: string;
  source: string;
  model: string;
  /** False when embeddings could not be computed at build time; search is then keyword-only. */
  hasVectors: boolean;
  entries: BundledEntry[];
}

export const bundleFile = () => path.join(bundleDir(), "index.json");

export function writeBundle(index: BundledIndex) {
  fs.mkdirSync(bundleDir(), { recursive: true });
  const tmp = `${bundleFile()}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(index));
  fs.renameSync(tmp, bundleFile());
}

const cache = globalThis as unknown as { __blackbookBundle?: { file: string; mtime: number; index: BundledIndex } };

/** The bundled index, or null when this deployment was built without one. Parsed once per instance. */
export function readBundle(): BundledIndex | null {
  const file = bundleFile();
  try {
    const mtime = fs.statSync(file).mtimeMs;
    if (cache.__blackbookBundle?.file === file && cache.__blackbookBundle.mtime === mtime) return cache.__blackbookBundle.index;
    const index = JSON.parse(fs.readFileSync(file, "utf8")) as BundledIndex;
    if (index.version !== 1 || !Array.isArray(index.entries)) return null;
    cache.__blackbookBundle = { file, mtime, index };
    return index;
  } catch {
    return null;
  }
}

export const bundleUsable = (index: BundledIndex) => index.hasVectors && index.model === EMBEDDING_MODEL.version;
