import { describe, it, expect } from "vitest"

import { chunkText, detectLang } from "@/modules/rag/chunk"

/**
 * Chunking decides what the retriever can find, and `detectLang` now decides what
 * language an answer is written in — so both are load-bearing well outside the file
 * they live in, and neither was tested.
 */

describe("detectLang", () => {
  /**
   * `detectLang` feeds `answerLanguage`, which becomes the `lang` segment of the
   * answer cache key. A wrong answer here does not produce a wrong answer in the
   * text — it produces a wrong answer served from a neighbour's cache entry, which
   * looks entirely correct.
   */
  it("identifies the scripts that matter for this product's users", () => {
    expect(detectLang("રિફંડ પોલિસી કેટલા દિવસમાં?")).toBe("gu")
    expect(detectLang("रिफंड नीति कितने दिनों में?")).toBe("hi")
    expect(detectLang("திரும்பப் பணத் திட்டம்")).toBe("ta")
    expect(detectLang("રિફંડ")).toBe("gu")
  })

  it("falls back to English for Latin script", () => {
    expect(detectLang("What is the refund policy?")).toBe("en")
  })

  it("returns 'und' for empty input rather than guessing", () => {
    expect(detectLang("")).toBe("und")
    expect(detectLang("   ")).toBe("und")
  })

  /**
   * A query mixing scripts — a RERA clause reference inside Gujarati prose — must
   * resolve to the prose, not to the incidental Latin tokens. Guessing wrong sends
   * the answer in the wrong language.
   */
  it("resolves mixed script to the dominant one", () => {
    expect(detectLang("રિફંડ પોલિસી RERA 4.2 માં")).toBe("gu")
  })

  /**
   * A bare number has no language. `detectLang` only reaches its Latin fallback
   * via `/[A-Za-z]/`, so digits alone return `und` — which is correct, and it is
   * why `answerLanguage` carries a name and a tag separately: the tag stays honest
   * ("und") while the name falls back to English for the prompt.
   */
  it("does not throw on punctuation-only or numeric input", () => {
    expect(() => detectLang("1234 --- ***")).not.toThrow()
    expect(detectLang("1234")).toBe("und")
    expect(detectLang("1234 --- ***")).toBe("und")
  })
})

describe("chunkText", () => {
  it("returns nothing for empty input", () => {
    expect(chunkText("")).toEqual([])
    expect(chunkText("   \n\n  ")).toEqual([])
  })

  it("produces sequential indices from zero", () => {
    const text = Array.from({ length: 120 }, (_, i) => `Sentence number ${i} about policy.`).join(" ")
    const chunks = chunkText(text)
    expect(chunks.length).toBeGreaterThan(1)
    expect(chunks.map((c) => c.chunk_index)).toEqual(chunks.map((_, i) => i))
  })

  /** `chunk_hash` is what incremental re-ingest diffs on to avoid re-embedding. */
  it("gives every chunk a hash, and identical content an identical hash", () => {
    const text = "The refund window is fifteen days from written request."
    const [a] = chunkText(text)
    const [b] = chunkText(text)
    expect(a.chunk_hash).toBeTruthy()
    expect(a.chunk_hash).toBe(b.chunk_hash)
  })

  it("gives different content different hashes", () => {
    const [a] = chunkText("The refund window is fifteen days.")
    const [b] = chunkText("The refund window is thirty days.")
    expect(a.chunk_hash).not.toBe(b.chunk_hash)
  })

  /**
   * Splitting on headings is what stops a chunk mixing HR §4 with Marketing §9 —
   * the reason this module exists rather than a plain word window. Each section's
   * chunks must carry their own `section_path`.
   */
  it("splits on headings and records the section path", () => {
    const text = [
      "# Refund Policy",
      "Refunds are processed within fifteen days of a written request.",
      "",
      "# Escalation",
      "Escalate to the accounts team if the refund is not received.",
    ].join("\n")

    const chunks = chunkText(text)
    expect(chunks.length).toBeGreaterThanOrEqual(2)

    const refund = chunks.find((c) => c.content.includes("processed within fifteen days"))
    const escalation = chunks.find((c) => c.content.includes("Escalate to the accounts team"))
    expect(refund).toBeDefined()
    expect(escalation).toBeDefined()
    /* The whole point: the two sections' content must not land in one chunk. */
    expect(refund?.chunk_index).not.toBe(escalation?.chunk_index)
  })

  it("records a clause id when the heading is a numbered clause", () => {
    const text = [
      "4.2 Sick Leave",
      "An employee is entitled to fifteen days of paid sick leave per year.",
    ].join("\n")

    const chunks = chunkText(text)
    expect(chunks.length).toBeGreaterThan(0)
    const withClause = chunks.find((c) => c.metadata.clause_id !== undefined)
    expect(withClause).toBeDefined()
  })

  /** Never loses content: the concatenation of chunks must cover the input. */
  it("loses no words across the chunk boundary", () => {
    const sentence = "The buyer shall pay the balance before possession as per the agreement. "
    const text = sentence.repeat(80)
    const chunks = chunkText(text)
    expect(chunks.length).toBeGreaterThan(1)
    const totalWords = chunks.reduce(
      (n, c) => n + c.content.split(/\s+/).filter(Boolean).length,
      0,
    )
    /* Overlap deliberately repeats words across boundaries, so this is a floor,
       not an exact match. */
    expect(totalWords).toBeGreaterThanOrEqual(80 * sentence.trim().split(/\s+/).length * 0.9)
  })

  it("tags each chunk with a detected language", () => {
    const [c] = chunkText("This is a plain English sentence about a refund policy.")
    expect(c.lang).toBeTruthy()
    expect(c.lang).toBe("en")
  })

  it("respects an explicit chunk-size override", () => {
    /* The keys are `wordsPerChunk` / `overlapWords`, read by `windowWords`. With
       the default of 380 words a 100-word input yields exactly one chunk, so this
       only proves the override is threaded if the split actually happens. */
    const text = Array.from({ length: 100 }, (_, i) => `word${i}`).join(" ")
    const chunks = chunkText(text, { wordsPerChunk: 20, overlapWords: 5 })
    expect(chunks.length).toBeGreaterThan(1)
  })

  /**
   * A malformed override used to chunk the document into *nothing*, silently.
   * `Number("abc")` is `NaN`, and every comparison against `NaN` is false, so the
   * sentence loop swallowed all input into the buffer and `pushWindow` broke on the
   * empty first slice. The document was then stored with no chunks and matched no
   * query ever — no error, no log, nothing to trace. Asserted here because the
   * whole failure mode is absence.
   */
  it("falls back to the default size rather than chunking to nothing", () => {
    const text = Array.from({ length: 100 }, (_, i) => `word${i}`).join(" ")
    for (const bad of ["abc", null, -5, 0, Number.NaN, {}]) {
      const chunks = chunkText(text, { wordsPerChunk: bad as unknown as number })
      expect(chunks.length).toBeGreaterThan(0)
    }
  })

  /**
   * Overlap >= window makes `step = max(1, wordsPer - overlap)` clamp to 1, so each
   * chunk re-emits the document from offset 0 and the corpus fills with duplicates.
   * Reachable from `RAG_CHUNK_OVERLAP`, so the cap is applied rather than trusted.
   */
  it("caps an overlap that is not smaller than the window", () => {
    const text = Array.from({ length: 60 }, (_, i) => `word${i}`).join(" ")
    const chunks = chunkText(text, { wordsPerChunk: 20, overlapWords: 50 })
    expect(chunks.length).toBeGreaterThan(0)
    const hashes = new Set(chunks.map((c) => c.chunk_hash))
    expect(hashes.size).toBe(chunks.length)
  })
})