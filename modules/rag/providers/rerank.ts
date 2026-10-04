/**
 * Cross-Encoder Reranking (Retrieval Stage 2)
 * Scores query+chunk jointly to sharpen top-k before generation.
 * Rotation pool; mock keeps original order.
 */

import { fetchJson, runPool } from "./http";

const MAX_CHARS = Number(process.env.RAG_RERANK_MAX_CHARS || 2000);
const TIMEOUT_MS = Number(process.env.RAG_RERANK_TIMEOUT_MS || 15000);

interface RerankInput {
  query: string;
  docs: string[];
  topK: number;
}

interface RerankOrder {
  order: Array<{ index: number; score: number }>;
}

const truncate = (s = ""): string => {
  const t = String(s);
  return t.length > MAX_CHARS ? t.slice(0, MAX_CHARS) : t;
};

const normalize = (order: Array<{ index: number; score: number }>): Array<{ index: number; score: number }> => {
  const scores = order.map((o) => o.score);
  const lo = Math.min(...scores);
  const hi = Math.max(...scores);
  const span = hi - lo;
  return order.map((o) => ({
    ...o,
    score: span > 0 ? (o.score - lo) / span : 1,
  }));
};

// Jina reranker.
const jina = {
  name: "jina-rerank",
  isEnabled: () => !!process.env.JINA_API_KEY,
  call: async ({ query, docs, topK }: RerankInput): Promise<RerankOrder> => {
    const json = await fetchJson<{ results: Array<{ index: number; relevance_score: number }> }>(
      "https://api.jina.ai/v1/rerank",
      {
        headers: { authorization: `Bearer ${process.env.JINA_API_KEY}` },
        body: {
          model: "jina-reranker-v2-base-multilingual",
          query: truncate(query),
          documents: docs.map(truncate),
          top_n: topK,
        },
        timeoutMs: TIMEOUT_MS,
      }
    );
    return { order: normalize(json.results.map((r) => ({ index: r.index, score: r.relevance_score }))) };
  },
};

// Cohere rerank.
const cohere = {
  name: "cohere-rerank",
  isEnabled: () => !!process.env.COHERE_API_KEY,
  call: async ({ query, docs, topK }: RerankInput): Promise<RerankOrder> => {
    const json = await fetchJson<{ results: Array<{ index: number; relevance_score: number }> }>(
      "https://api.cohere.com/v2/rerank",
      {
        headers: { authorization: `Bearer ${process.env.COHERE_API_KEY}` },
        body: { model: "rerank-multilingual-v3.0", query: truncate(query), documents: docs.map(truncate), top_n: topK },
        timeoutMs: TIMEOUT_MS,
      }
    );
    return { order: normalize(json.results.map((r) => ({ index: r.index, score: r.relevance_score }))) };
  },
};

// Mock
const mock = async ({ docs, topK }: RerankInput): Promise<RerankOrder> => ({
  order: docs.slice(0, topK).map((_, i) => ({ index: i, score: 1 - i / Math.max(docs.length, 1) })),
});

/* The shared pipeline type. This file previously declared its own copy with a
   different field list, which is why `rerank(...)` could not accept a chunk from
   `scoreChunks` without an `as any` at the call site. */
import type { ScoredChunk } from "../types";

/**
 * rerank(query, chunks[], topK) -> reordered chunks with .rerankScore
 * Chunks keep their fusedScore; callers prefer rerankScore then fall back.
 *
 * Generic in the chunk type so the caller's own shape survives the round trip.
 * Reranking is a pure reordering plus one added field — it does not transform a
 * chunk — so declaring a fixed `ScoredChunk` return type discarded fields the
 * caller legitimately has. `retrieve.ts` was losing `vecScore`, `kwScore`,
 * `modality` and `lang` here and had to cast its way back to them.
 */
export const rerank = async <T extends ScoredChunk>(
  query: string,
  chunks: T[],
  topK: number
): Promise<T[]> => {
  if (!chunks.length) return [];
  const docs = chunks.map((c) => String(c.content || ""));
  const { order } = await runPool("rerank", [jina, cohere], { query, docs, topK }, mock);

  /* Two guards on what the provider handed back, neither of which `top_n` in the
     request body guarantees.

     Dedupe by index: the order arrives in descending relevance, so the first
     occurrence of an index is its best score and the later ones are noise. Without
     this, a repeated index emits the same chunk twice — and downstream
     `buildContext` numbers each input and `answer.ts` gives each its own citation,
     so one document becomes two apparently independent sources quoting identical
     text. That is precisely the corroboration a citation-backed system exists to
     make impossible to fake.

     Bound to `topK`: `topK` is the caller's budget for what reaches the generator.
     Trusting the provider to honour `top_n` means a provider that returns more —
     a different default, an API change, a miscounted response — silently widens
     the context and the generation cost with it. Provider order is preserved
     rather than re-sorted, so the truncation keeps the most relevant entries. */
  const seen = new Set<number>();
  const usable = order.filter((o) => {
    if (!chunks[o.index]) return false; // out of range
    if (seen.has(o.index)) return false; // repeated
    seen.add(o.index);
    return true;
  });

  return usable
    .slice(0, Math.max(0, topK))
    .map((o) => ({ ...chunks[o.index], rerankScore: o.score }));
};