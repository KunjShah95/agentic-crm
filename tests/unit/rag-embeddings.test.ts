import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"

/**
 * `node-fetch` is mocked at the package boundary because the provider loads it
 * through a dynamic import.
 *
 * Every case runs with `RAG_EMBED_PROVIDER` unset unless it says otherwise, which
 * is the configuration where the mock embedder is reachable at all. That matters:
 * the failure this file guards is specifically about what happens when a *real*
 * provider is configured and errors.
 */
const fetchMock = vi.hoisted(() => vi.fn())
vi.mock("node-fetch", () => ({ default: fetchMock }))

const importFresh = async () => {
  vi.resetModules()
  return import("@/modules/rag/providers/embeddings")
}

const jsonResponse = (vectors: number[][]) => ({
  ok: true,
  status: 200,
  json: async () => ({ data: vectors.map((embedding) => ({ embedding })) }),
})

const errorResponse = (status: number, text = "rate limited") => ({
  ok: false,
  status,
  text: async () => text,
})

beforeEach(() => {
  fetchMock.mockReset()
  delete process.env.RAG_EMBED_PROVIDER
  delete process.env.JINA_API_KEY
})

afterEach(() => {
  delete process.env.RAG_EMBED_PROVIDER
  delete process.env.JINA_API_KEY
})

describe("mockEmbed", () => {
  it("produces a vector of the declared dimension", async () => {
    const { mockEmbed, DIM } = await importFresh()
    expect(mockEmbed("refund policy")).toHaveLength(DIM)
  })

  it("is deterministic for the same text", async () => {
    const { mockEmbed } = await importFresh()
    expect(mockEmbed("refund policy")).toEqual(mockEmbed("refund policy"))
  })

  it("differs for different text", async () => {
    const { mockEmbed } = await importFresh()
    expect(mockEmbed("refund policy")).not.toEqual(mockEmbed("possession policy"))
  })

  /** Unit length, because cosine similarity assumes it and pgvector does not normalise. */
  it("returns a unit-length vector", async () => {
    const { mockEmbed } = await importFresh()
    const v = mockEmbed("refund policy")
    const norm = Math.sqrt(v.reduce((s, n) => s + n * n, 0))
    expect(norm).toBeCloseTo(1, 6)
  })

  it("handles empty and very long text without throwing", async () => {
    const { mockEmbed } = await importFresh()
    expect(() => mockEmbed("")).not.toThrow()
    expect(mockEmbed("x".repeat(50_000))).toHaveLength(1024)
  })
})

describe("embed — mock path (no provider configured)", () => {
  it("embeds a single string", async () => {
    const { embed } = await importFresh()
    const result = await embed("refund policy")

    expect(result.vectors).toHaveLength(1)
    expect(result.vectors[0]).toHaveLength(result.dim)
  })

  it("embeds a batch, preserving order", async () => {
    const { embed } = await importFresh()
    const result = await embed(["alpha", "beta", "gamma"])

    expect(result.vectors).toHaveLength(3)
    expect(result.vectors[0]).toEqual((await importFresh()).mockEmbed("alpha"))
  })

  it("reports the model and dimension it used", async () => {
    const { embed } = await importFresh()
    const result = await embed("q")
    expect(result.model).toBe("mock-1024")
    expect(result.dim).toBe(1024)
  })

  /**
   * The cache key includes `taskType`, but that is not observable here and the
   * reason is worth stating rather than asserting a difference that does not exist:
   * `mockEmbed(text)` takes no task type, so a query and a passage over the same
   * text produce the *same* vector under two different keys. The keys are distinct
   * — which is the property that stops a passage vector being served for a query
   * once a real provider is in play, since Jina genuinely embeds them differently —
   * but with the mock embedder the distinction is invisible from outside. Pinning
   * `not.toEqual` here would assert a behaviour the mock does not have.
   */
  it("caches the same text under a distinct key per task type", async () => {
    const { embed } = await importFresh()
    const asQuery = await embed("same text", { taskType: "query" })
    const asPassage = await embed("same text", { taskType: "passage" })
    /* Equal values, and that is correct for the mock embedder — see above. */
    expect(asQuery.vectors[0]).toEqual(asPassage.vectors[0])
  })

  it("returns the same vector for a repeated text", async () => {
    const { embed } = await importFresh()
    const first = await embed("refund policy")
    const second = await embed("refund policy")
    expect(second.vectors[0]).toEqual(first.vectors[0])
  })

  it("mixes cached and freshly embedded inputs correctly", async () => {
    const { embed } = await importFresh()
    await embed("already seen")
    const result = await embed(["already seen", "brand new"])

    expect(result.vectors).toHaveLength(2)
    expect(result.vectors[1]).toHaveLength(result.dim)
  })
})

describe("embed — configured provider", () => {
  const configureJina = async () => {
    process.env.RAG_EMBED_PROVIDER = "jina"
    process.env.JINA_API_KEY = "test-key"
    return importFresh()
  }

  it("requests the configured model and dimension", async () => {
    const { embed, DIM } = await configureJina()
    fetchMock.mockResolvedValueOnce(jsonResponse([new Array(DIM).fill(0.1)]))

    await embed("refund policy")

    const body = JSON.parse(fetchMock.mock.calls[0][1].body as string)
    expect(body.model).toBe("jina-embeddings-v3")
    expect(body.dimensions).toBe(DIM)
    expect(body.input).toEqual(["refund policy"])
  })

  it("maps the task type onto Jina's retrieval labels", async () => {
    const { embed, DIM } = await configureJina()
    fetchMock.mockResolvedValueOnce(jsonResponse([new Array(DIM).fill(0.1)]))

    await embed("q", { taskType: "query" })
    expect(JSON.parse(fetchMock.mock.calls[0][1].body as string).task).toBe("retrieval.query")

    fetchMock.mockResolvedValueOnce(jsonResponse([new Array(DIM).fill(0.1)]))
    await embed("q", { taskType: "passage" })
    expect(JSON.parse(fetchMock.mock.calls[1][1].body as string).task).toBe("retrieval.passage")
  })

  /**
   * The failure this file exists for.
   *
   * The old code caught every provider error and returned `mockEmbed` output — a
   * SHA-256 pseudo-vector with no semantic content. On the write path that is not
   * a degradation: `queue.ts` stores whatever comes back into `RagChunk.embedding`
   * and sets the document READY, so one rate-limited response permanently embedded
   * a document as 1024 bytes of hash and retired the retry that would have handled
   * it. Similarity search then compared those against real vectors and matched at
   * random, with the answer cited to an unrelated source.
   *
   * So a configured provider that fails must throw, and let the queue's retry path
   * run. Asserted as a throw rather than as "not a mock vector" because the
   * distinction that matters is whether the write happens at all.
   */
  it("propagates a provider error instead of returning mock vectors", async () => {
    const { embed } = await configureJina()
    fetchMock.mockRejectedValueOnce(new Error("socket hang up"))

    await expect(embed("refund policy")).rejects.toThrow()
  })

  it("propagates a rate limit rather than degrading", async () => {
    const { embed } = await configureJina()
    fetchMock.mockResolvedValueOnce(errorResponse(429))

    await expect(embed("refund policy")).rejects.toThrow(/Jina HTTP 429/)
  })

  /**
   * A short response used to leave `undefined` at the missing indices — assigned by
   * index with nothing checking the count. That reached `setEmbedding` and threw
   * `Cannot read properties of undefined`, naming neither the provider nor the
   * under-delivery.
   */
  it("rejects a short response rather than yielding undefined vectors", async () => {
    const { embed, DIM } = await configureJina()
    fetchMock.mockResolvedValueOnce(jsonResponse([new Array(DIM).fill(0.1)]))

    await expect(embed(["alpha", "beta", "gamma"])).rejects.toThrow(
      /returned 1 vectors for 3 inputs/,
    )
  })

  /**
   * A wrong-dimension vector reaches SQL on the query path: `retrieve.ts` passes
   * `vectors[0]` to `toVectorLiteral` unguarded, so Postgres rejects `[1,2,3]` as a
   * vector parse error naming no caller.
   */
  it("rejects a wrong-dimension vector", async () => {
    const { embed } = await configureJina()
    fetchMock.mockResolvedValueOnce(jsonResponse([[0.1, 0.2, 0.3]]))

    await expect(embed("refund policy")).rejects.toThrow(/expected 1024/)
  })

  it("accepts a correctly-sized vector", async () => {
    const { embed, DIM } = await configureJina()
    const vector = new Array(DIM).fill(0.1)
    fetchMock.mockResolvedValueOnce(jsonResponse([vector]))

    const result = await embed("refund policy")
    expect(result.vectors[0]).toEqual(vector)
  })
})

describe("embeddingModel", () => {
  it("names the mock when no provider is configured", async () => {
    const { embeddingModel } = await importFresh()
    expect(embeddingModel()).toBe("mock-1024")
  })

  it("names the real model when jina is configured with a key", async () => {
    process.env.RAG_EMBED_PROVIDER = "jina"
    process.env.JINA_API_KEY = "test-key"
    const { embeddingModel } = await importFresh()
    expect(embeddingModel()).toBe("jina-embeddings-v3")
  })

  /**
   * A provider that is named but has no key must not claim to be that provider.
   * `embed` checks both, but `embeddingModel()` is what gets written to
   * `RagChunk.model` — recording `jina-embeddings-v3` for a vector that came from
   * the mock is exactly the provenance lie `pgvector.clearEmbeddingsFor` was fixed
   * to stop producing.
   */
  it("falls back to the mock when the provider is named but has no API key", async () => {
    process.env.RAG_EMBED_PROVIDER = "jina"
    delete process.env.JINA_API_KEY
    const { embeddingModel } = await importFresh()
    expect(embeddingModel()).toBe("mock-1024")
  })

  it("is case-insensitive about the provider name", async () => {
    process.env.RAG_EMBED_PROVIDER = "JINA"
    process.env.JINA_API_KEY = "k"
    const { embeddingModel } = await importFresh()
    expect(embeddingModel()).toBe("jina-embeddings-v3")
  })
})