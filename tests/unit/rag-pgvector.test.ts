import { describe, it, expect, vi, beforeEach } from "vitest"

/**
 * `db.$queryRaw` / `$executeRaw` are tagged-template functions, so each call
 * arrives as `(stringsArray, ...values)`. Capturing that split is what lets these
 * tests assert two different things that matter here:
 *
 *   - the SQL *text* — that a filter is present, that tenant scoping is present
 *   - the *bound values* — that user input is a parameter and not string-concatenated
 *
 * The second is the one that matters most. The vector is interpolated as a literal
 * rather than bound, because pgvector needs `::vector`. That is only safe because
 * every element is checked `Number.isFinite` first, and `Number.isFinite` is false
 * for strings — so a caller cannot smuggle SQL through the join.
 */
const db = vi.hoisted(() => ({
  $queryRaw: vi.fn(),
  $executeRaw: vi.fn(),
}))

vi.mock("@/lib/db", () => ({ db }))

const { EMBEDDING_DIM, setEmbedding, clearEmbeddingsFor, findChunksNeedingEmbedding, findChunksForReingest } =
  await import("@/modules/rag/pgvector")

/** Reassemble a tagged-template call into its SQL text and bound values. */
const call = (mock: ReturnType<typeof vi.fn>, index = 0) => {
  const [strings, ...values] = mock.mock.calls[index] as [TemplateStringsArray, ...unknown[]]
  return { sql: strings.join("?"), values }
}

const vector = (n = EMBEDDING_DIM, fill = 0.5) => new Array<number>(n).fill(fill)

beforeEach(() => {
  db.$queryRaw.mockReset().mockResolvedValue([])
  db.$executeRaw.mockReset().mockResolvedValue(1)
})

describe("EMBEDDING_DIM", () => {
  /**
   * Pinned against the schema. `RagChunk.embedding` is
   * `Unsupported("vector(1024)")`, so this constant and the column have to agree —
   * and nothing in the type system connects them, since `Unsupported` fields are
   * absent from the generated client entirely. A change to the column dimension
   * without a change here would fail at the first insert, as a pgvector dimension
   * error, for every embedding in the system.
   */
  it("matches the vector(1024) column declared in the schema", () => {
    expect(EMBEDDING_DIM).toBe(1024)
  })
})

describe("setEmbedding", () => {
  it("writes a correctly-sized vector", async () => {
    await setEmbedding("t1", "c1", vector(), "jina-embeddings-v3")

    expect(db.$executeRaw).toHaveBeenCalledTimes(1)
    const { sql, values } = call(db.$executeRaw)
    expect(sql).toContain('UPDATE "RagChunk"')
    expect(sql).toContain('SET "embedding" = ?::vector')
    expect(values).toContain("jina-embeddings-v3")
    expect(values).toContain(EMBEDDING_DIM)
  })

  it("serialises the vector as a bracketed pgvector literal", async () => {
    await setEmbedding("t1", "c1", vector(EMBEDDING_DIM, 0.25), "model")

    const { values } = call(db.$executeRaw)
    const literal = values.find((v) => typeof v === "string" && v.startsWith("[")) as string

    expect(literal.startsWith("[")).toBe(true)
    expect(literal.endsWith("]")).toBe(true)
    expect(literal.slice(1, -1).split(",")).toHaveLength(EMBEDDING_DIM)
    expect(literal).toContain("0.25")
  })

  /** Tenant and chunk id must be bound parameters, never concatenated. */
  it("binds the tenant and chunk id rather than inlining them", async () => {
    await setEmbedding("t1", "c1", vector(), "model")

    const { sql, values } = call(db.$executeRaw)
    expect(sql).not.toContain("t1")
    expect(sql).not.toContain("c1")
    expect(values).toContain("t1")
    expect(values).toContain("c1")
    expect(sql).toContain('WHERE "id" = ? AND "tenantId" = ?')
  })

  /**
   * The dimension check is the reason this module is more than a cast. Without it
   * a wrong-length vector reaches Postgres and fails as an opaque pgvector error —
   * naming a column, not the caller — possibly halfway through a batch, after
   * some chunks were already written.
   */
  it("rejects a short vector before touching the database", async () => {
    await expect(setEmbedding("t1", "c1", vector(512), "m")).rejects.toThrow(
      /dimension mismatch: expected 1024, received 512/,
    )
    expect(db.$executeRaw).not.toHaveBeenCalled()
  })

  it("rejects a long vector before touching the database", async () => {
    await expect(setEmbedding("t1", "c1", vector(2048), "m")).rejects.toThrow(
      /dimension mismatch/,
    )
    expect(db.$executeRaw).not.toHaveBeenCalled()
  })

  it("rejects an empty vector", async () => {
    await expect(setEmbedding("t1", "c1", [], "m")).rejects.toThrow(/dimension mismatch/)
    expect(db.$executeRaw).not.toHaveBeenCalled()
  })

  /**
   * `NaN` and `Infinity` are `typeof "number"`, so a length check alone lets them
   * through — and they serialise into the literal as `NaN`/`Infinity`, which
   * Postgres rejects with a vector parse error that identifies nothing about the
   * caller. These come straight out of an embedding provider that returned a
   * degenerate response.
   */
  it.each([
    ["NaN", Number.NaN],
    ["Infinity", Number.POSITIVE_INFINITY],
    ["-Infinity", Number.NEGATIVE_INFINITY],
  ])("rejects %s before touching the database", async (_label, bad) => {
    const v = vector()
    v[7] = bad as number

    await expect(setEmbedding("t1", "c1", v, "m")).rejects.toThrow(/non-finite value/)
    expect(db.$executeRaw).not.toHaveBeenCalled()
  })

  /**
   * The injection guard. `embedding.join(",")` concatenates, and pgvector requires
   * a literal rather than a bound parameter — so this is the one place in the RAG
   * pipeline where caller-supplied values are stringified into SQL. It is safe
   * only because `Number.isFinite` rejects every non-numeric value, and a string
   * cannot reach the join. If that check were ever removed or loosened, this
   * becomes a direct injection point.
   */
  it("refuses a string element, which is what makes the literal safe", async () => {
    const v = vector() as unknown as unknown[]
    v[3] = "0.5); DROP TABLE \"RagChunk\"; --"

    await expect(
      setEmbedding("t1", "c1", v as unknown as number[], "m"),
    ).rejects.toThrow(/non-finite value/)
    expect(db.$executeRaw).not.toHaveBeenCalled()
  })

  it("propagates a database failure rather than swallowing it", async () => {
    db.$executeRaw.mockRejectedValueOnce(new Error("connection lost"))
    await expect(setEmbedding("t1", "c1", vector(), "m")).rejects.toThrow("connection lost")
  })
})

describe("clearEmbeddingsFor", () => {
  /**
   * All three columns, not just the vector. Leaving `model` and `dim` set while
   * `embedding` is null is what made the provenance columns lie: a chunk that
   * claims to have been embedded by `jina-embeddings-v3` at 1024 dimensions while
   * holding no vector at all.
   */
  it("clears the vector and its provenance together", async () => {
    await clearEmbeddingsFor("t1", "doc1")

    const { sql } = call(db.$executeRaw)
    expect(sql).toContain('SET "embedding" = NULL')
    expect(sql).toContain('"model" = NULL')
    expect(sql).toContain('"dim" = NULL')
  })

  it("scopes the update to one document in one tenant", async () => {
    await clearEmbeddingsFor("t1", "doc1")

    const { sql, values } = call(db.$executeRaw)
    expect(sql).toContain('WHERE "tenantId" = ? AND "documentId" = ?')
    expect(values).toEqual(["t1", "doc1"])
  })
})

describe("findChunksNeedingEmbedding", () => {
  it("filters on the vector being null", async () => {
    await findChunksNeedingEmbedding("t1", "doc1")

    const { sql } = call(db.$queryRaw)
    expect(sql).toContain('"embedding" IS NULL')
  })

  /**
   * `content` is selected here rather than by the caller because the caller's only
   * job is to embed that text. Splitting the read would let the text and the
   * "needs embedding" decision come from different snapshots, and a concurrent
   * re-ingest would then embed stale content against a fresh row.
   */
  it("selects the content the caller needs to embed", async () => {
    await findChunksNeedingEmbedding("t1", "doc1")

    const { sql } = call(db.$queryRaw)
    expect(sql).toContain('SELECT "id", "content", "chunkIndex"')
  })

  it("orders by chunk index so embedding order is deterministic", async () => {
    await findChunksNeedingEmbedding("t1", "doc1")

    const { sql } = call(db.$queryRaw)
    expect(sql).toContain('ORDER BY "chunkIndex" ASC')
  })

  it("scopes to the tenant and document", async () => {
    await findChunksNeedingEmbedding("t1", "doc1")

    const { sql, values } = call(db.$queryRaw)
    expect(values).toEqual(["t1", "doc1"])
    expect(sql).not.toContain("doc1")
  })

  it("returns whatever the query produced", async () => {
    db.$queryRaw.mockResolvedValueOnce([{ id: "c1", content: "text", chunkIndex: 0 }])

    await expect(findChunksNeedingEmbedding("t1", "doc1")).resolves.toEqual([
      { id: "c1", content: "text", chunkIndex: 0 },
    ])
  })

  it("returns an empty worklist for a fully embedded document", async () => {
    db.$queryRaw.mockResolvedValueOnce([])
    await expect(findChunksNeedingEmbedding("t1", "doc1")).resolves.toEqual([])
  })
})

describe("findChunksForReingest", () => {
  it("reads the vector alongside its provenance", async () => {
    await findChunksForReingest("t1", "doc1")

    const { sql } = call(db.$queryRaw)
    expect(sql).toContain('"embedding"')
    expect(sql).toContain('"model"')
    expect(sql).toContain('"dim"')
  })

  /**
   * Deliberately *not* filtered on `embedding IS NULL`. Re-ingest needs to know
   * which chunks already have a usable vector so it can reuse them instead of
   * paying for the embedding API again on unchanged content.
   */
  it("is not restricted to chunks lacking a vector", async () => {
    await findChunksForReingest("t1", "doc1")

    const { sql } = call(db.$queryRaw)
    expect(sql).not.toContain("IS NULL")
  })

  it("orders by chunk index so re-indexing is stable", async () => {
    await findChunksForReingest("t1", "doc1")

    const { sql } = call(db.$queryRaw)
    expect(sql).toContain('ORDER BY "chunkIndex" ASC')
  })

  it("scopes to the tenant and document", async () => {
    await findChunksForReingest("t1", "doc1")
    expect(call(db.$queryRaw).values).toEqual(["t1", "doc1"])
  })
})