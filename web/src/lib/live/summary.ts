import { readBundle } from "./bundle";
import { usesBundledIndex } from "./paths";
import { readStatus } from "./status";

/**
 * Facts for the Explore page header. Deliberately free of embed, search and PGlite imports so the
 * page module can never fail to load because of the native ONNX runtime.
 */
export async function indexSummary() {
  if (usesBundledIndex()) {
    const index = readBundle();
    return index && { builtAt: index.builtAt, entries: index.entries.length };
  }
  const lastGood = readStatus().lastGood;
  return lastGood && { builtAt: lastGood.at, entries: lastGood.merged };
}
