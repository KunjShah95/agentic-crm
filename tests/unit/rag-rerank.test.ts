import { describe, it, expect, vi, beforeEach } from "vitest"

/**
 * `runPool` is mocked so a specific provider payload can be driven in.
 *
 * The real pool needs an API key in the environment, and without one every call
 * lands on the mock — which returns exactly `topK` well-formed, unique indices.
 * That is the one shape where the ordering bugs below cannot appear, so testing
 * against the mock alone would assert the happy path and nothing else.
 */
const runPool = vi.hoisted(() => vi.fn());
vi.mock("@/modules/rag/providers/http", () => ({ runPool, fetchJson: vi.fn() }));

const { rerank } = await import("@/modules/rag/providers/rerank")

type Chunk = { chunkId: string; content: string; documentId: string; fusedScore?: number }

const chunks = (n: number): Chunk[] =>
  Array.from({ length: n }, (_, i) => ({
    chunkId: `c${i}`,
    content: `document ${i} about the refund policy`,
    documentId: "d1",
    fusedScore: 0.5,
  }))

/** Make the pool resolve with this exact order list. */
const returnsOrder = (order: Array<{ index: number; score: number }>) =>
  runPool.mockResolvedValue({ order, providerUsed: "test" })

beforeEach(() => runPool.mockReset())

describe("rerank", () => {
  it("returns nothing for an empty input without calling the pool", async () => {
    expect(await rerank("q", [], 5)).toEqual([])
    expect(runPool).not.toHaveBeenCalled()
  })

  it("reorders chunks to match the provider's order", async () => {
    returnsOrder([
      { index: 2, score: 1 },
      { index: 0, score: 0.5 },
      { index: 1, score: 0 },
    ])

    const result = await rerank("q", chunks(3), 3)

    expect(result.map((c) => c.chunkId)).toEqual(["c2", "c0", "c1"])
  })

  /** Reranking reorders and annotates; it must not alter the chunks themselves. */
  it("preserves every field on a chunk, adding only rerankScore", async () => {
    returnsOrder([{ index: 0, score: 1 }])

    const input = [{ ...chunks(1)[0], vecScore: 0.9, kwScore: 0.1, modality: "text" } as Chunk]
    const result = await rerank("q", input as never, 1)

    expect(result[0].chunkId).toBe("c0")
    expect(result[0].rerankScore).toBe(1)
  })

  it("discards an index that does not correspond to a chunk", async () => {
    /* A provider returning an out-of-range index would otherwise be a TypeError on
       `chunks[o.index]` at best, or an undefined chunk silently in the citation
       list at worst. */
    returnsOrder([
      { index: 0, score: 1 },
      { index: 99, score: 0.9 },
      { index: 1, score: 0.1 },
    ])

    const result = await rerank("q", chunks(2), 3)

    expect(result.map((c) => c.chunkId)).toEqual(["c0", "c1"])
  })

  /**
   * A repeated index must not produce the same chunk twice.
   *
   * This is not cosmetic. Downstream, `buildContext` numbers its inputs and emits
   * `[Source N: ...]`, and `answer.ts` maps each source to its own citation — so a
   * duplicated chunk becomes two apparently-independent sources quoting identical
   * text. A reader cross-checking citations sees two agreeing sources where there
   * is only one, which is exactly the corroboration a citation-backed system is
   * supposed to make impossible to fake.
   */
  it("collapses a repeated index rather than emitting the chunk twice", async () => {
    returnsOrder([
      { index: 1, score: 1 },
      { index: 1, score: 0.9 },
      { index: 0, score: 0.5 },
    ])

    const result = await rerank("q", chunks(2), 3)

    expect(result.map((c) => c.chunkId)).toEqual(["c1", "c0"])
    expect(new Set(result.map((c) => c.chunkId)).size).toBe(result.length)
  })

  /**
   * `topK` is the caller's budget for what reaches the generator. Trusting the
   * provider to honour `top_n` means a provider that returns more — a different
   * default, an API change, a miscounted response — quietly widens the context
   * and the generation cost with it. Bounding here makes the contract local.
   */
  it("never returns more than topK chunks", async () => {
    returnsOrder(
      Array.from({ length: 10 }, (_, i) => ({ index: i, score: 1 - i / 10 }))
    )

    const result = await rerank("q", chunks(10), 3)

    expect(result.length).toBeLessThanOrEqual(3)
  })

  it("keeps the highest-scored entries when truncating to topK", async () => {
    returnsOrder([
      { index: 0, score: 0.1 },
      { index: 1, score: 0.9 },
      { index: 2, score: 0.5 },
    ])

    const result = await rerank("q", chunks(3), 2)

    expect(result.map((c) => c.chunkId)).toEqual(["c0", "c1"])
  })

  it("handles an empty provider order", async () => {
    returnsOrder([])
    expect(await rerank("q", chunks(3), 3)).toEqual([])
  })

  it("tolerates null content on a chunk", async () => {
    returnsOrder([{ index: 0, score: 1 }])

    const result = await rerank("q", [{ chunkId: "c0", content: null as never, documentId: "d1" }], 1)

    expect(result).toHaveLength(1)
  })

  it("passes the chunk contents as the documents to rank", async () => {
    returnsOrder([{ index: 0, score: 1 }])

    await rerank("the query", chunks(2), 2)

    /* runPool(poolName, providers, payload, mock) — the payload is the third
       argument. */
    const payload = runPool.mock.calls[0][2] as { query: string; docs: string[]; topK: number }
    expect(payload.query).toBe("the query")
    expect(payload.docs).toHaveLength(2)
    expect(payload.docs[0]).toContain("document 0")
    expect(payload.topK).toBe(2)
  })

  it("identifies itself as the rerank pool with both providers", async () => {
    returnsOrder([{ index: 0, score: 1 }])
    await rerank("q", chunks(1), 1)

    const [poolName, providers] = runPool.mock.calls[0] as [string, unknown[]]
    expect(poolName).toBe("rerank")
    expect(providers).toHaveLength(2)
  })
})