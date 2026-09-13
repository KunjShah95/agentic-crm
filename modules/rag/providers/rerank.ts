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

interface ChunkWithScore {
  content: string;
  fusedScore?: number;
  rerankScore?: number;
  score?: number;
  documentId: string;
  [key: string]: unknown;
}

/**
 * rerank(query, chunks[], topK) -> reordered chunks with .rerankScore
 * Chunks keep their fusedScore; callers prefer rerankScore then fall back.
 */
export const rerank = async (query: string, chunks: ChunkWithScore[], topK: number): Promise<ChunkWithScore[]> => {
  if (!chunks.length) return [];
  const docs = chunks.map((c) => String(c.content || ""));
  const { order } = await runPool("rerank", [jina, cohere], { query, docs, topK }, mock);
  return order
    .filter((o) => chunks[o.index])
    .map((o) => ({ ...chunks[o.index], rerankScore: o.score }));
};