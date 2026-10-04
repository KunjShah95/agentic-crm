import { describe, it, expect, vi, beforeEach } from "vitest"

/**
 * `generate` is mocked so the JSON-returning paths are actually reachable.
 *
 * With no provider configured the real `generate` falls back to an extractive mock
 * that echoes context prose, so `JSON.parse` throws and every classifier takes its
 * catch branch. Tests written against that fallback pass identically before and
 * after a fix to the success branch — which is how a defect in parsing an LLM
 * response survives a test suite. Driving the JSON by hand is the only way these
 * cases mean anything.
 */
const generate = vi.hoisted(() => vi.fn());

vi.mock("@/modules/rag/providers/llm", () => ({ generate }));

const { QueryEnhancer } = await import("@/modules/rag/query-enhancer");
const { answerLanguage, wasRewritten } = await import("@/modules/rag/language");

/** Queue the next `generate` call to return this text. */
const responds = (text: string) => generate.mockResolvedValueOnce({ text, providerUsed: "test" });

describe("answerLanguage", () => {
  /**
   * The corpus is English (RERA / Gujarat regulation), so retrieval queries are
   * rewritten into English on purpose. These cases pin the *answer* language, which
   * must come from the user's own words — the defect being guarded against is a
   * Gujarati question being answered in English because the model was handed the
   * English rewrite and told to match its language.
   */

  it("reads Gujarati from Gujarati script, not from the English rewrite", () => {
    const language = answerLanguage("રિફંડ પોલિસી કેટલા દિવસમાં?")
    expect(language.tag).toBe("gu")
    expect(language.name).toBe("Gujarati")
  })

  it("reads Devanagari as Hindi", () => {
    const language = answerLanguage("रिफंड नीति कितने दिनों में?")
    expect(language.tag).toBe("hi")
    expect(language.name).toBe("Hindi")
  })

  it("stays English for English input", () => {
    const language = answerLanguage("What is the refund window for RERA deposits?")
    expect(language.tag).toBe("en")
    expect(language.name).toBe("English")
  })

  /**
   * `tag` partitions the cache and `name` goes in the prompt. Returning the tag
   * where a name is expected is the silent failure: the prompt would read "answer
   * in gu", the model would default to English, and every assertion on `tag`
   * would still pass.
   */
  it("always returns a name a prompt can use, never a bare tag", () => {
    for (const input of ["રિફંડ પોલિસી", "रिफंड नीति", "refund policy", "", "1234"]) {
      expect(answerLanguage(input).name).toMatch(/^[A-Z][a-z]+$/)
    }
  })

  it("falls back to English rather than emitting an undetermined tag as the name", () => {
    const language = answerLanguage("")
    expect(language.tag).toBe("und")
    expect(language.name).toBe("English")
  })
})

describe("wasRewritten", () => {
  it("is false when the rewrite left the question alone", () => {
    expect(wasRewritten("What is the refund policy?", "What is the refund policy?")).toBe(false)
  })

  it("ignores surrounding whitespace when comparing", () => {
    expect(wasRewritten("  What is the refund policy?  ", "What is the refund policy?")).toBe(false)
  })

  it("is true when a follow-up reference was resolved", () => {
    expect(wasRewritten("what about that one?", "What is the refund window under RERA?")).toBe(true)
  })

  /**
   * An empty original must not count as "rewritten" — the original wording is
   * appended to the prompt when this is true, and an empty quote reads to the model
   * as the user having said nothing at all.
   */
  it("treats an empty original as not rewritten", () => {
    expect(wasRewritten("", "What is the refund policy?")).toBe(false)
    expect(wasRewritten("   ", "What is the refund policy?")).toBe(false)
  })
})

describe("QueryEnhancer.classifyIntent", () => {
  beforeEach(() => generate.mockReset())

  it("reads a well-formed classification", async () => {
    responds(JSON.stringify({ intent: "policy", alpha: 0.3 }))
    const result = await QueryEnhancer.classifyIntent("What is the refund policy?")
    expect(result.intent).toBe("policy")
    expect(result.alpha).toBe(0.3)
  })

  /**
   * `alpha` is the vector/keyword blend. Unclamped, 95 means the query is treated
   * as near-pure semantic similarity with keyword matching effectively off — and
   * for a question containing a RERA clause number that is the retrieval that finds
   * nothing, silently. 95 is a perfectly valid number, so the search still returns
   * results, just the wrong ones, with nothing logged.
   */
  it("clamps an alpha above 1", async () => {
    responds(JSON.stringify({ intent: "factual", alpha: 95 }))
    const result = await QueryEnhancer.classifyIntent("What is the refund policy?")
    expect(result.alpha).toBe(1)
  })

  it("clamps an alpha below 0", async () => {
    responds(JSON.stringify({ intent: "factual", alpha: -3 }))
    const result = await QueryEnhancer.classifyIntent("What is the refund policy?")
    expect(result.alpha).toBe(0)
  })

  it("rejects a non-numeric alpha and falls back to the balanced default", async () => {
    responds(JSON.stringify({ intent: "factual", alpha: "high" }))
    const result = await QueryEnhancer.classifyIntent("What is the refund policy?")
    expect(result.alpha).toBe(0.5)
  })

  it("does not pass through a non-string intent", async () => {
    responds(JSON.stringify({ intent: { name: "policy" }, alpha: 0.5 }))
    const result = await QueryEnhancer.classifyIntent("What is the refund policy?")
    expect(result.intent).toBe("unknown")
  })

  it("falls back rather than throwing when the model returns prose", async () => {
    responds("I'm sorry, I cannot help with that.")
    const result = await QueryEnhancer.classifyIntent("What is the refund policy?")
    expect(result).toEqual({ intent: "unknown", alpha: 0.5 })
  })
})

describe("QueryEnhancer.decompose", () => {
  beforeEach(() => generate.mockReset())

  it("returns the parsed sub-questions", async () => {
    responds(JSON.stringify(["What is the refund timeframe?", "How is a claim filed?"]))
    const parts = await QueryEnhancer.decompose("Refund policy and claim process?")
    expect(parts).toEqual(["What is the refund timeframe?", "How is a claim filed?"])
  })

  /**
   * `Array.isArray(parsed) && parsed.length > 0` is satisfied by an array of
   * objects, so `[{"q": "..."}]` used to pass straight through and reach the
   * retriever as an object. The failure was silent: the search could not match it
   * and returned nothing, with no error anywhere to explain the empty timeline.
   */
  it("drops non-string elements instead of passing them to the retriever", async () => {
    responds(JSON.stringify([{ q: "What is the refund timeframe?" }, "How is a claim filed?"]))
    const parts = await QueryEnhancer.decompose("Refund policy and claim process?")
    expect(parts).toEqual(["How is a claim filed?"])
  })

  it("falls back to the original query when every element is unusable", async () => {
    responds(JSON.stringify([{ q: "a" }, 42, null]))
    const parts = await QueryEnhancer.decompose("Refund policy?")
    expect(parts).toEqual(["Refund policy?"])
  })

  it("falls back when the array is empty", async () => {
    responds(JSON.stringify([]))
    const parts = await QueryEnhancer.decompose("Refund policy?")
    expect(parts).toEqual(["Refund policy?"])
  })

  it("falls back when the response is not JSON", async () => {
    responds("Two sub-questions:\n1. What is the timeframe?")
    const parts = await QueryEnhancer.decompose("Refund policy?")
    expect(parts).toEqual(["Refund policy?"])
  })
})

describe("QueryEnhancer.rewrite", () => {
  beforeEach(() => generate.mockReset())

  it("returns the rewritten query", async () => {
    responds("What is the RERA refund window for a booked unit?")
    const rewritten = await QueryEnhancer.rewrite("what about that one?")
    expect(rewritten).toBe("What is the RERA refund window for a booked unit?")
  })

  /**
   * An empty rewrite becomes the retrieval query itself, and `retrieve` treats an
   * empty string as no query at all — so a provider that returns whitespace would
   * silently take the whole document set instead of one answer's worth.
   */
  it("falls back to the input when the model returns nothing usable", async () => {
    responds("   ")
    const rewritten = await QueryEnhancer.rewrite("What is the refund policy?")
    expect(rewritten).toBe("What is the refund policy?")
  })
})