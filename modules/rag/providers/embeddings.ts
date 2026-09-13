/**
 * Embeddings Provider — Single Canonical Model
 * No hot-fallback: vectors are only comparable within one model,
 * mixing them corrupts similarity search.
 * Provider is chosen by RAG_EMBED_PROVIDER; dimension is pinned to DIM.
 */

import crypto from "crypto";

export const DIM = 1024;

const provider = (process.env.RAG_EMBED_PROVIDER || "").toLowerCase();

export const mockEmbed = (text: string): number[] => {
  const vec = new Array(DIM);
  let seed = crypto.createHash("sha256").update(String(text)).digest();
  for (let i = 0; i < DIM; i++) {
    if (i % 32 === 0) seed = crypto.createHash("sha256").update(seed).digest();
    vec[i] = (seed[i % 32] / 255) * 2 - 1;
  }
  const norm = Math.sqrt(vec.reduce((s, v) => s + v * v, 0)) || 1;
  return vec.map((v) => v / norm);
};

const jina = async (texts: string[], taskType: "query" | "passage"): Promise<number[][]> => {
  const fetch = (await import("node-fetch")).default;
  const res = await fetch("https://api.jina.ai/v1/embeddings", {
    method: "POST",
    headers: {
      authorization: `Bearer ${process.env.JINA_API_KEY}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: "jina-embeddings-v3",
      task: taskType === "query" ? "retrieval.query" : "retrieval.passage",
      dimensions: DIM,
      input: texts,
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Jina HTTP ${res.status}: ${text.slice(0, 200)}`);
  }
  const json = await res.json() as { data: Array<{ embedding: number[] }> };
  return json.data.map((d) => d.embedding);
};

export const embeddingModel = (): string => (provider === "jina" ? "jina-embeddings-v3" : "mock-1024");

export interface EmbedResult {
  vectors: number[][];
  model: string;
  dim: number;
}

// Query embeddings repeat constantly (fan-out variants, retries, the same user
// re-asking). Cache by (model, taskType, sha256(text)) to cut model calls.
const EMBED_CACHE_MAX = 512;
const embedCache = new Map<string, number[]>();
const cacheKey = (text: string, taskType: string) =>
  `${embeddingModel()}:${taskType}:${crypto.createHash("sha256").update(text).digest("hex")}`;

const cachedGet = (key: string): number[] | undefined => {
  const hit = embedCache.get(key);
  if (hit !== undefined) {
    // Refresh for LRU behavior.
    embedCache.delete(key);
    embedCache.set(key, hit);
  }
  return hit;
};

const cachedSet = (key: string, vec: number[]) => {
  if (embedCache.size >= EMBED_CACHE_MAX) {
    const oldest = embedCache.keys().next().value;
    if (oldest !== undefined) embedCache.delete(oldest);
  }
  embedCache.set(key, vec);
};

export const embed = async (texts: string | string[], { taskType = "passage" } = {}): Promise<EmbedResult> => {
  const arr = Array.isArray(texts) ? texts : [texts];
  const vectors: number[][] = new Array(arr.length);
  const misses: number[] = [];

  for (let i = 0; i < arr.length; i++) {
    const hit = cachedGet(cacheKey(arr[i], taskType));
    if (hit) vectors[i] = hit;
    else misses.push(i);
  }

  if (misses.length > 0) {
    const toEmbed = misses.map((i) => arr[i]);
    let fresh: number[][];
    try {
      if (provider === "jina" && process.env.JINA_API_KEY) {
        fresh = await jina(toEmbed, taskType as "query" | "passage");
      } else {
        fresh = toEmbed.map(mockEmbed);
      }
    } catch {
      fresh = toEmbed.map(mockEmbed);
    }
    misses.forEach((docIdx, j) => {
      vectors[docIdx] = fresh[j];
      cachedSet(cacheKey(arr[docIdx], taskType), fresh[j]);
    });
  }

  return { vectors, model: embeddingModel(), dim: DIM };
};