import path from "node:path";
import { env, pipeline } from "@huggingface/transformers";
import { EMBEDDING_MODEL } from "./model";
import { dataDir } from "./paths";

type Extractor = (
  texts: string[],
  options: { pooling: "cls"; normalize: boolean },
) => Promise<{ tolist(): number[][] }>;

const globalCache = globalThis as unknown as { __blackbookEmbedder?: Promise<Extractor> };

/** Runs the pinned model on this machine: no API key, no provider, no per-call cost. */
export function loadEmbedder() {
  if (!globalCache.__blackbookEmbedder) {
    env.cacheDir = path.join(dataDir(), "models");
    globalCache.__blackbookEmbedder = pipeline("feature-extraction", EMBEDDING_MODEL.id, {
      revision: EMBEDDING_MODEL.revision,
      dtype: EMBEDDING_MODEL.dtype,
    }) as unknown as Promise<Extractor>;
    globalCache.__blackbookEmbedder.catch(() => {
      globalCache.__blackbookEmbedder = undefined;
    });
  }
  return globalCache.__blackbookEmbedder;
}

export async function embedPassages(texts: string[]) {
  const extractor = await loadEmbedder();
  const vectors: number[][] = [];
  for (let start = 0; start < texts.length; start += 32) {
    const output = await extractor(texts.slice(start, start + 32), { pooling: "cls", normalize: true });
    vectors.push(...output.tolist());
  }
  return vectors;
}

export async function embedQuery(text: string) {
  const extractor = await loadEmbedder();
  const output = await extractor([EMBEDDING_MODEL.queryPrefix + text], { pooling: "cls", normalize: true });
  return output.tolist()[0];
}
