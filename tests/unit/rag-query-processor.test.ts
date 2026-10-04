import { describe, it, expect, vi, beforeEach } from "vitest"

/**
 * `generate` is mocked so each classifier can be driven with a specific model
 * response — including malformed ones, which is where the interesting behaviour
 * lives. Without this the real provider pool falls through to its extractive mock,
 * which returns prose rather than JSON, and every parse-failure path goes untested.
 */
const generate = vi.hoisted(() => vi.fn());
vi.mock("@/modules/rag/providers/llm", () => ({ generate }));

const { classifyIntent, decomposeQuery, expandQuery, processQuery, getIntentDescription } =
  await import("@/modules/rag/query-processor");

const responds = (text: string) => generate.mockResolvedValueOnce({ text, providerUsed: "test" });

beforeEach(() => generate.mockReset())

describe("classifyIntent", () => {
  it("recognises each valid intent", async () => {
    for (const intent of ["factual", "procedural", "comparative", "creative", "ambiguous"]) {
      responds(intent)
      await expect(classifyIntent("a query")).resolves.toBe(intent)
    }
  })

  it("normalises case and surrounding whitespace", async () => {
    responds("  Comparative  ")
    await expect(classifyIntent("q")).resolves.toBe("comparative")
  })

  /**
   * Falls back to `factual`, which is the safest default: it retrieves directly
   * without decomposing, so a mislabelled query narrows rather than fans out. The
   * alternative — accepting an unrecognised label — would put the string into
   * `decomposeQuery`, whose intent gate would then treat it as decomposable and
   * make three speculative searches out of one question.
   */
  it("falls back to factual for an unrecognised intent", async () => {
    responds("interpretive")
    await expect(classifyIntent("q")).resolves.toBe("factual")
  })

  it("falls back to factual when the model throws", async () => {
    generate.mockRejectedValueOnce(new Error("provider down"))
    await expect(classifyIntent("q")).resolves.toBe("factual")
  })
})

describe("decomposeQuery", () => {
  /**
   * Skips the LLM entirely for intents that should not be split. A factual lookup
   * decomposed into sub-questions turns one precise retrieval into several vague
   * ones, and each is a separate chance to surface the wrong clause.
   */
  it.each(["factual", "procedural", "ambiguous"])(
    "returns the query unchanged for a %s intent, without calling the model",
    async (intent) => {
      await expect(decomposeQuery("what is the refund window", intent)).resolves.toEqual([
        "what is the refund window",
      ])
      expect(generate).not.toHaveBeenCalled()
    },
  )

  it("decomposes a comparative query", async () => {
    responds(JSON.stringify(["What is the HR refund policy?", "What is the Finance refund policy?"]))

    const parts = await decomposeQuery("Compare refund policies", "comparative")

    expect(parts).toHaveLength(2)
  })

  /** Sub-questions below 10 characters are fragments, not questions. */
  it("discards sub-questions that are too short to be meaningful", async () => {
    responds(JSON.stringify(["ok", "What is the refund policy for buyers?"]))

    const parts = await decomposeQuery("Compare refund policies", "comparative")

    expect(parts).toEqual(["What is the refund policy for buyers?"])
  })

  it("discards non-string entries", async () => {
    responds(JSON.stringify([{ q: "an object" }, 42, null, "What is the escalation path?"]))

    const parts = await decomposeQuery("Compare policies", "comparative")

    expect(parts).toEqual(["What is the escalation path?"])
  })

  it("falls back to the query when the model returns a non-array", async () => {
    responds(JSON.stringify({ subQuestions: ["a"] }))
    await expect(decomposeQuery("Compare", "comparative")).resolves.toEqual(["Compare"])
  })

  it("falls back to the query when the response is not JSON", async () => {
    responds("First, the HR policy. Second, Finance.")
    await expect(decomposeQuery("Compare", "comparative")).resolves.toEqual(["Compare"])
  })

  it("falls back to the query when every entry is filtered out", async () => {
    responds(JSON.stringify(["ok", "no"]))
    await expect(decomposeQuery("Compare", "comparative")).resolves.toEqual(["Compare"])
  })
})

describe("expandQuery", () => {
  it("returns parsed expansions", async () => {
    responds(JSON.stringify(["refund timeframe", "money back period"]))

    const expansions = await expandQuery("refund")

    expect(expansions).toEqual(["refund timeframe", "money back period"])
  })

  it("drops non-string entries", async () => {
    responds(JSON.stringify(["valid expansion", { bad: true }, null]))
    await expect(expandQuery("q")).resolves.toEqual(["valid expansion"])
  })

  /**
   * Returns `[]` rather than throwing. Expansions are an optional recall boost —
   * `retrieve` adds them as extra retrieval variants — so losing them degrades
   * quality slightly, whereas throwing would abandon the whole answer.
   */
  it("returns an empty list rather than throwing on a bad response", async () => {
    responds("not json at all")
    await expect(expandQuery("q")).resolves.toEqual([])
  })

  it("returns an empty list when the model throws", async () => {
    generate.mockRejectedValueOnce(new Error("down"))
    await expect(expandQuery("q")).resolves.toEqual([])
  })
})

describe("processQuery", () => {
  it("omits expansions unless asked", async () => {
    responds("factual")

    const result = await processQuery("what is the refund window")

    expect(result.expansions).toEqual([])
  })

  it("requests expansions when asked", async () => {
    responds("factual") // classifyIntent
    responds(JSON.stringify(["refund timeframe"])) // expandQuery

    const result = await processQuery("what is the refund window", { expand: true })

    expect(result.expansions).toEqual(["refund timeframe"])
  })

  /** A duplicate expansion must not become a second retrieval of the same thing. */
  it("de-duplicates expansions that repeat a sub-question", async () => {
    responds("ambiguous") // intent -> no decomposition
    responds(JSON.stringify(["refund window", "refund window"]))

    const result = await processQuery("refund window", { expand: true })

    expect(result.subQueries).toEqual(["refund window"])
  })

  it("sets needsAggregation only when there is more than one sub-query", async () => {
    responds("ambiguous")
    const single = await processQuery("refund window")
    expect(single.needsAggregation).toBe(false)

    generate.mockReset()
    responds("comparative")
    responds(JSON.stringify(["What is the HR policy?", "What is the Finance policy?"]))
    const multi = await processQuery("compare policies")
    expect(multi.needsAggregation).toBe(true)
  })

  it("passes the original query through untouched", async () => {
    responds("factual")
    const result = await processQuery("  What is the refund window?  ")
    expect(result.originalQuery).toBe("  What is the refund window?  ")
  })
})

describe("getIntentDescription", () => {
  it("describes each known intent", () => {
    for (const intent of ["factual", "procedural", "comparative", "creative", "ambiguous"]) {
      expect(getIntentDescription(intent)).not.toBe("Unknown intent")
    }
  })

  it("is explicit about an unknown intent rather than returning undefined", async () => {
    await expect(classifyIntent("q")).resolves.toBeTypeOf("string")
    expect(getIntentDescription("interpretive")).toBe("Unknown intent")
  })
})