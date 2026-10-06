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

/**
 * The model name to record against a vector.
 *
 * Conditioned on the API key as well as the provider name, because this value is
 * written to `RagChunk.model` by the embedding queue. It read `provider === "jina"`
 * alone, so a deployment with `RAG_EMBED_PROVIDER=jina` and no `JINA_API_KEY`
 * produced mock vectors from `embed` — which checks both — while recording
 * `jina-embeddings-v3` beside them. The provenance column then named a model that
 * had not run, which is the same class of lie `pgvector.clearEmbeddingsFor` was
 * fixed to stop producing on the other side: a chunk claiming an embedding that
 * does not exist.
 *
 * Keep this condition identical to the `realProvider` check inside `embed`.
 */
const realProviderConfigured = (): boolean =>
  provider === "jina" && !!process.env.JINA_API_KEY;

export const embeddingModel = (): string =>
  realProviderConfigured() ? "jina-embeddings-v3" : "mock-1024";

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
    /* Whether a real provider is configured. Decided once per call and used to
       decide whether a failure is *degradable*.

       This module's own contract — in the header above — is that there is no
       hot-fallback, because vectors are only comparable within one model and
       mixing them corrupts similarity search. The unconditional `catch` this
       replaced did the opposite: any failure from the configured provider, a 429
       included, produced `mockEmbed` output — a SHA-256-derived pseudo-vector with
       no semantic content — and handed it to the caller as a real embedding.

       On the write path that was not a degradation but a corruption. `queue.ts`
       writes whatever comes back into `RagChunk.embedding` and then sets the
       document to READY, so one rate-limited response permanently embedded a
       document as 1024 bytes of hash, marked it complete, and retired the retry
       path that would otherwise have handled it. Every later similarity search
       compared those vectors against real ones and matched essentially at random,
       with the answer cited to a source that had no relationship to the question.
       `model` records `mock-1024` so it is detectable after the fact, but nothing
       acted on it and nothing re-embeds.

       So the mock is now only reachable when no provider is configured — local
       development and tests, which is what it is for. A configured provider that
       fails throws, and the embedding queue's existing retry-and-ERROR path does
       the right thing with it. */
    const realProvider = realProviderConfigured();
    const fresh = realProvider
      ? await jina(toEmbed, taskType as "query" | "passage")
      : toEmbed.map(mockEmbed);

    /* Validate the response before it is stored or cached.

       `fresh[j]` was assigned by index with nothing checking that the provider
       returned one vector per input. A short response therefore produced
       `undefined` in the result array and in the cache — self-healing on a later
       read, but the first caller got `undefined`, which reached `setEmbedding` and
       threw `Cannot read properties of undefined` rather than naming the provider
       that under-delivered. A wrong-dimension vector was equally unchecked, and
       that one does reach SQL: `retrieve.ts` passes the query vector to
       `toVectorLiteral` with no guard, so Postgres rejects it as a vector parse
       error naming no caller. */
    if (fresh.length !== toEmbed.length) {
      throw new Error(
        `embedding provider returned ${fresh.length} vectors for ${toEmbed.length} inputs`,
      );
    }
    for (const v of fresh) {
      if (!Array.isArray(v) || v.length !== DIM) {
        throw new Error(
          `embedding provider returned a ${Array.isArray(v) ? v.length : "non-array"} vector; expected ${DIM}`,
        );
      }
    }

    misses.forEach((docIdx, j) => {
      vectors[docIdx] = fresh[j];
      cachedSet(cacheKey(arr[docIdx], taskType), fresh[j]);
    });
  }

  return { vectors, model: embeddingModel(), dim: DIM };
};