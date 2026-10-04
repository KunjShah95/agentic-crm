import { describe, it, expect } from "vitest"

import { scoreChunks, REFUSAL } from "@/modules/rag/confidence"
import { checkFaithfulness } from "@/modules/rag/faithfulness"
import type { DocMeta, ScoredChunk } from "@/modules/rag/types"

/**
 * The two gates the RAG pipeline cannot be wrong about.
 *
 * `scoreChunks` decides whether the pipeline answers at all — below the threshold
 * it refuses without calling the model. `checkFaithfulness` decides whether an
 * answer is cached and shown as trustworthy. Both are pure functions with no
 * database, no LLM and no network, so they are cheap to pin exactly, and both were
 * previously untested.
 */

const chunk = (over: Partial<ScoredChunk> = {}): ScoredChunk => ({
  chunkId: "c1",
  content: "Refund is processed within 15 days of written request.",
  documentId: "d1",
  score: 0.9,
  ...over,
})

describe("scoreChunks", () => {
  /**
   * The gate's most important behaviour: no chunks must mean "refuse", not
   * "vacuously pass". `topConfidence` is seeded with `Math.max(0, ...)` precisely so
   * an empty array yields 0 rather than `-Infinity`, and 0 is below the threshold —
   * but only because of that seed, which is easy to break by changing the spread.
   */
  it("refuses on an empty candidate set", () => {
    const result = scoreChunks([])
    expect(result.scored).toEqual([])
    expect(result.topConfidence).toBe(0)
    expect(result.passed).toBe(false)
  })

  it("passes a well-retrieved, authoritative, recent chunk", () => {
    const docMeta: Record<string, DocMeta> = {
      d1: {
        title: "Refund policy",
        source_file: "refund.pdf",
        version: 1,
        department: null,
        doc_type: null,
        confidential: false,
        allowed_roles: [],
        status: "READY",
        created_at: new Date(),
        authority: 1,
      },
    }
    const result = scoreChunks([chunk()], docMeta)
    expect(result.passed).toBe(true)
    expect(result.topConfidence).toBeGreaterThanOrEqual(result.threshold)
  })

  it("refuses a chunk with no retrieval score at all", () => {
    const result = scoreChunks([chunk({ score: undefined, fusedScore: undefined })])
    /* 0.5*0 + 0.2*0.5 (no date) + 0.2*1 (default authority) + 0.1*agreement. With
       a single chunk agreement is 0.5, giving 0.35 — below the 0.65 default. */
    expect(result.topConfidence).toBeCloseTo(0.35, 5)
    expect(result.passed).toBe(false)
  })

  it("prefers `score` over `fusedScore` when both are present", () => {
    const result = scoreChunks([chunk({ score: 0.9, fusedScore: 0.1 })])
    expect(result.scored[0].components?.retrievalScore).toBe(0.9)
  })

  it("falls back to `fusedScore` when `score` is absent", () => {
    const result = scoreChunks([chunk({ score: undefined, fusedScore: 0.8 })])
    expect(result.scored[0].components?.retrievalScore).toBe(0.8)
  })

  /**
   * `created_at` is a nullable column, so `null` is a real value and not a
   * malformed one. It scores the neutral midpoint rather than 0 (maximally stale),
   * which would penalise every document that has never had its date set.
   */
  it("treats an absent creation date as neutral, not as stale", () => {
    const absent = scoreChunks([chunk()], {})
    const explicitNull = scoreChunks([chunk()], {
      d1: { created_at: null } as DocMeta,
    })
    expect(explicitNull.scored[0].components?.freshness).toBe(0.5)
    expect(absent.scored[0].components?.freshness).toBe(0.5)
  })

  it("decays freshness with age", () => {
    const twoYearsAgo = new Date(Date.now() - 730 * 86_400_000)
    const recent = scoreChunks([chunk()], { d1: { created_at: twoYearsAgo } as DocMeta })
    expect(recent.scored[0].components?.freshness).toBeCloseTo(0.5, 1)
  })

  /** Agreement is a cross-chunk signal, so one chunk has nothing to agree with. */
  it("scores agreement at the neutral midpoint for a lone chunk", () => {
    const result = scoreChunks([chunk()])
    expect(result.scored[0].components?.agreement).toBe(0.5)
  })

  it("clamps an out-of-range retrieval score into 0..1", () => {
    const high = scoreChunks([chunk({ score: 7 })])
    const low = scoreChunks([chunk({ score: -3 })])
    expect(high.scored[0].components?.retrievalScore).toBe(1)
    expect(low.scored[0].components?.retrievalScore).toBe(0)
  })

  it("preserves the original chunk fields alongside the score", () => {
    const result = scoreChunks([chunk({ metadata: { department: "sales" } })])
    expect(result.scored[0].chunkId).toBe("c1")
    expect(result.scored[0].metadata).toEqual({ department: "sales" })
    expect(typeof result.scored[0].confidence).toBe("number")
  })

  it("returns the highest confidence as the gate value, not the average", () => {
    const result = scoreChunks([
      chunk({ chunkId: "weak", score: 0.1 }),
      chunk({ chunkId: "strong", score: 0.95 }),
    ])
    expect(result.topConfidence).toBe(result.scored[1].confidence)
    expect(result.passed).toBe(true)
  })
})

describe("REFUSAL", () => {
  it("is a fixed, quotable string rather than a template", () => {
    expect(REFUSAL).toBe(
      "The provided documents do not contain sufficient information to answer this question.",
    )
  })
})

describe("checkFaithfulness", () => {
  const ctx = [
    { content: "Refunds are processed within 15 days of a written request. Contact the accounts team." },
  ]

  /**
   * The refusal is what the pipeline returns when it declines to answer. Flagging
   * it would make the safety mechanism look like a failure, and blocking the cache
   * write for it would mean every out-of-scope question re-runs the whole
   * retrieval.
   */
  it("does not flag the refusal string", () => {
    const result = checkFaithfulness(REFUSAL, ctx)
    expect(result.flagged).toEqual([])
    expect(result.passed).toBe(true)
  })

  it("passes an answer fully supported by the context", () => {
    const result = checkFaithfulness(
      "Refunds are processed within 15 days [Source 1].",
      ctx,
    )
    expect(result.flagged).toEqual([])
    expect(result.faithfulness).toBe(1)
    expect(result.passed).toBe(true)
  })

  /**
   * Numbers need verbatim grounding, with no fuzzy fallback — the module's own
   * rule 3, and the reason a policy figure cannot be paraphrased. This is the
   * highest-consequence case in the whole check: a wrong RERA timeline reads as
   * authoritative precisely because it carries a specific figure.
   */
  it("flags a number that appears nowhere in the context", () => {
    const result = checkFaithfulness("Refunds are processed within 45 days.", ctx)
    expect(result.flagged).toContain("45")
    expect(result.passed).toBe(false)
  })

  it("flags a date the context never mentions", () => {
    const result = checkFaithfulness("The policy took effect on 12/03/2024.", ctx)
    expect(result.flagged.length).toBeGreaterThan(0)
    expect(result.passed).toBe(false)
  })

  it("ignores citation markers when extracting assertions", () => {
    /* `[Source 1]` is the model's own bookkeeping, not a claim about the world.
       Counting it as an assertion would let a well-cited answer score lower than an
       uncited one. */
    const cited = checkFaithfulness("Refunds are processed within 15 days. [Source 1]", ctx)
    const uncited = checkFaithfulness("Refunds are processed within 15 days.", ctx)
    expect(cited.faithfulness).toBe(uncited.faithfulness)
    expect(cited.checked).toBe(uncited.checked)
  })

  /**
   * No extractable assertions means nothing was found to contradict — not that
   * something was verified. The score is 1 by construction and `checked: 0` is the
   * only signal distinguishing it from a fully-grounded answer, so that is what
   * the assertion pins.
   */
  it("reports zero checked assertions when nothing is extractable", () => {
    const result = checkFaithfulness("", ctx)
    expect(result.checked).toBe(0)
    expect(result.faithfulness).toBe(1)
    expect(result.flagged).toEqual([])
  })

  it("handles an empty context without throwing", () => {
    const result = checkFaithfulness("Refunds take 15 days.", [])
    expect(result.passed).toBe(false)
  })

  it("handles a null-ish answer without throwing", () => {
    expect(() => checkFaithfulness(undefined as unknown as string, ctx)).not.toThrow()
  })

  it("includes parentContext in the grounding corpus", () => {
    /* A claim supported only by the parent section the chunk was expanded from is
       grounded. Excluding parentContext would flag correct answers whenever the
       retrieval expanded a child chunk against its parent. */
    const withParent = checkFaithfulness("Refunds take 45 days.", [
      { content: "See the parent section for timelines.", parentContext: "Refunds take 45 days." },
    ])
    expect(withParent.passed).toBe(true)
  })
})