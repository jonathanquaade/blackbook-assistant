import { EMBEDDING_MODEL } from "./model";
import { modelCacheDir } from "./paths";

type Extractor = (
  texts: string[],
  options: { pooling: "cls"; normalize: boolean },
) => Promise<{ tolist(): number[][] }>;

const globalCache = globalThis as unknown as { __blackbookEmbedder?: Promise<Extractor> };

async function createExtractor(): Promise<Extractor> {
  // Lazy on purpose: the native ONNX runtime must never load (or crash) a page that only reads the index.
  // Any import failure rejects here and the caller degrades to keyword-only search.
  const { env, pipeline } = await import("@huggingface/transformers");
  env.cacheDir = modelCacheDir();
  return (await pipeline("feature-extraction", EMBEDDING_MODEL.id, {
    revision: EMBEDDING_MODEL.revision,
    dtype: EMBEDDING_MODEL.dtype,
  })) as unknown as Extractor;
}

/** Runs the pinned model on this machine: no API key, no provider, no per-call cost. */
export function loadEmbedder() {
  if (!globalCache.__blackbookEmbedder) {
    globalCache.__blackbookEmbedder = createExtractor();
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
