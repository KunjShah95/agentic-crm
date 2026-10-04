/**
 * Source Confidence Scoring + Halt Gate
 * confidence = 0.5*retrieval + 0.2*freshness + 0.2*authority + 0.1*agreement
 * If no chunk clears CONFIDENCE_MIN, the pipeline refuses to generate.
 */

const CONFIDENCE_MIN = Number(process.env.RAG_CONFIDENCE_MIN || 0.65);
const FRESHNESS_HALFLIFE_DAYS = Number(process.env.RAG_FRESHNESS_HALFLIFE || 730); // ~2y

/* Shared with the reranker and the answer pipeline. This file and
   `providers/rerank.ts` each declared their own `ScoredChunk` with a
   different field list, which is what forced `as any` on every handoff between
   them in `answer.ts` and `retrieve.ts`. */
import type { DocMeta, ScoredChunk, ScoredResult } from "./types";

/* `null` is accepted alongside `undefined` because `DocMeta.created_at` comes
   straight from a nullable Postgres column. Without it the caller had to cast the
   column value to make the type check, which is what hid the fact that a
   document with no creation date was being treated as maximally stale-or-fresh
   depending on the caller's assertion. An absent date scores 0.5 — the neutral
   midpoint — rather than 0. */
const freshness = (createdAt?: string | Date | null): number => {
  if (!createdAt) return 0.5;
  const ageDays = (Date.now() - new Date(createdAt).getTime()) / 86_400_000;
  return Math.pow(0.5, Math.max(0, ageDays) / FRESHNESS_HALFLIFE_DAYS); // decay 1 -> 0.5 per half-life
};

// crude lexical overlap as a cross-chunk agreement proxy (no extra deps).
const agreement = (chunk: ScoredChunk, all: ScoredChunk[]): number => {
  if (all.length < 2) return 0.5;
  const toks = (s: string) => new Set(String(s).toLowerCase().split(/\W+/).filter((w) => w.length > 3));
  const a = toks(chunk.content);
  if (!a.size) return 0;
  let sum = 0;
  let n = 0;
  for (const other of all) {
    if (other.chunkId === chunk.chunkId) continue;
    const b = toks(other.content);
    let inter = 0;
    for (const t of a) if (b.has(t)) inter++;
    sum += inter / a.size;
    n++;
  }
  return n ? Math.min(1, sum / n) : 0.5;
}

/**
 * scoreChunks(chunks, docMeta) -> chunks annotated with .confidence, plus gate result.
 */
export const scoreChunks = (chunks: ScoredChunk[], docMeta: Record<string, DocMeta> = {}): ScoredResult => {
  const scored: ScoredChunk[] = chunks.map((c) => {
    const doc = docMeta[c.documentId] || {};
    const retrievalScore = Math.max(0, Math.min(1, c.score ?? c.fusedScore ?? 0));
    const f = freshness(doc.created_at);
    const authority = Math.max(0, Math.min(1, doc.authority ?? 1));
    const agree = agreement(c, chunks);
    const confidence = 0.5 * retrievalScore + 0.2 * f + 0.2 * authority + 0.1 * agree;
    return { ...c, confidence, components: { retrievalScore, freshness: f, authority, agreement: agree } };
  });
  /* `confidence` is assigned on the line above and is non-optional on
     `ScoredChunk` only as an optional property, so the read is `number |
     undefined`. The `?? 0` is not a fudge: `Math.max` below already seeds with 0
     so that an empty `scored` array yields 0 rather than `-Infinity`, and this
     only makes the per-element case explicit rather than relying on the spread. */
  const top = Math.max(0, ...scored.map((c) => c.confidence ?? 0));
  return { scored, passed: top >= CONFIDENCE_MIN, topConfidence: top, threshold: CONFIDENCE_MIN };
};

export const REFUSAL =
  "The provided documents do not contain sufficient information to answer this question.";