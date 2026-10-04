import { describe, it, expect, vi, beforeEach } from "vitest"

const db = vi.hoisted(() => ({
  ragFeedback: { create: vi.fn(), findMany: vi.fn() },
}))
const ingestDocument = vi.hoisted(() => vi.fn())
const invalidateTenant = vi.hoisted(() => vi.fn())
const invalidateScope = vi.hoisted(() => vi.fn())

vi.mock("@/lib/db", () => ({ db }))
vi.mock("@/modules/rag/ingest", () => ({ ingestDocument }))
vi.mock("@/modules/rag/cache", () => ({ invalidateTenant }))
vi.mock("@/modules/rag/semantic-cache", () => ({
  semanticCache: { invalidateScope },
}))

const { submitFeedback, listFeedback } = await import("@/modules/rag/feedback")

beforeEach(() => {
  db.ragFeedback.create.mockReset().mockResolvedValue({ id: "fb1" })
  db.ragFeedback.findMany.mockReset().mockResolvedValue([])
  ingestDocument.mockReset().mockResolvedValue({ id: "doc1" })
  invalidateTenant.mockReset().mockResolvedValue(undefined)
  invalidateScope.mockReset().mockResolvedValue(undefined)
})

const opts = { tenantId: "t1", userId: "u1", query: "What is the refund window?", rating: 1 as const }

describe("submitFeedback", () => {
  it("records the feedback row", async () => {
    const result = await submitFeedback(opts)

    expect(result).toEqual({ id: "fb1" })
    const data = db.ragFeedback.create.mock.calls[0][0].data
    expect(data.tenantId).toBe("t1")
    expect(data.query).toBe("What is the refund window?")
    expect(data.rating).toBe(1)
    expect(data.createdBy).toBe("u1")
  })

  /* Postgres columns are non-null or explicitly null — never the string "undefined". */
  it("stores absent optional fields as null rather than undefined", async () => {
    await submitFeedback(opts)

    const data = db.ragFeedback.create.mock.calls[0][0].data
    expect(data.answer).toBeNull()
    expect(data.correction).toBeNull()
    expect(data.documentId).toBeNull()
  })

  it("does not ingest a document when there is no correction", async () => {
    await submitFeedback(opts)
    expect(ingestDocument).not.toHaveBeenCalled()
  })

  it("promotes a correction into the knowledge base", async () => {
    await submitFeedback({ ...opts, correction: "Refunds are processed within 15 days." })

    expect(ingestDocument).toHaveBeenCalledTimes(1)
    const payload = ingestDocument.mock.calls[0][0]
    expect(payload.tenantId).toBe("t1")
    expect(payload.file.buffer.toString("utf8")).toBe("Refunds are processed within 15 days.")
    expect(payload.tags).toContain("correction")
  })

  /**
   * The filename is derived from `Date.now()`, so two corrections for the same
   * query landing in the same millisecond get the same name. `ingestDocument`
   * dedupes on `externalId`, and none is passed here, so name collision does not
   * merge them — every submission creates another document. Asserted so the growth
   * is a known quantity rather than an accident: it is unbounded across a tenant's
   * lifetime, and each one also triggers a full cache invalidation below.
   */
  it("creates a distinct document per correction", async () => {
    await submitFeedback({ ...opts, correction: "first" })
    await submitFeedback({ ...opts, correction: "second" })

    expect(ingestDocument).toHaveBeenCalledTimes(2)
    const first = ingestDocument.mock.calls[0][0].file.originalname
    const second = ingestDocument.mock.calls[1][0].file.originalname
    expect(first).toMatch(/\.txt$/)
    expect(second).toMatch(/\.txt$/)
  })

  /**
   * A correction enters the corpus at `authority: 1.0`, the maximum that
   * `scoreChunks` will accept. In the confidence formula that is a flat `0.2` —
   * the largest single contributor after retrieval itself — so a user-submitted
   * correction outranks the compliance documents it sits beside.
   *
   * Pinned rather than changed: whether a correction should outweigh the source it
   * corrects is a product judgement, not a bug fix. But it is currently the maximum
   * with no review step, and a test that asserts the number is what stops it being
   * altered by accident.
   */
  it("ingests corrections at maximum authority", async () => {
    await submitFeedback({ ...opts, correction: "Refunds are processed within 15 days." })
    expect(ingestDocument.mock.calls[0][0].authority).toBe(1.0)
  })

  it("scopes an ingested correction to the submitting tenant", async () => {
    await submitFeedback({ ...opts, correction: "x" })
    expect(ingestDocument.mock.calls[0][0].tenantId).toBe("t1")
  })

  /* A correction changes what the corpus answers, so every cached answer may be stale. */
  it("invalidates both cache layers", async () => {
    await submitFeedback(opts)

    expect(invalidateTenant).toHaveBeenCalledWith("t1")
    expect(invalidateScope).toHaveBeenCalledWith("t1")
  })

  it("invalidates after ingesting, so the new document is not served from a warm cache", async () => {
    const order: string[] = []
    ingestDocument.mockImplementation(async () => {
      order.push("ingest")
      return { id: "doc1" }
    })
    invalidateTenant.mockImplementation(async () => {
      order.push("invalidate")
    })

    await submitFeedback({ ...opts, correction: "x" })

    expect(order).toEqual(["ingest", "invalidate"])
  })

  it("returns the created row", async () => {
    db.ragFeedback.create.mockResolvedValue({ id: "fb9", rating: -1 })
    await expect(submitFeedback({ ...opts, rating: -1 })).resolves.toEqual({ id: "fb9", rating: -1 })
  })
})

describe("listFeedback", () => {
  it("returns the rows newest first, scoped to the tenant", async () => {
    db.ragFeedback.findMany.mockResolvedValue([{ id: "fb2" }, { id: "fb1" }])

    const result = await listFeedback({ tenantId: "t1" })

    expect(result).toHaveLength(2)
    const args = db.ragFeedback.findMany.mock.calls[0][0]
    expect(args.where).toEqual({ tenantId: "t1" })
    expect(args.orderBy).toEqual({ createdAt: "desc" })
  })

  /** An unbounded list would return a tenant's entire feedback history in one response. */
  it("caps the page size", async () => {
    await listFeedback({ tenantId: "t1" })
    expect(db.ragFeedback.findMany.mock.calls[0][0].take).toBe(100)
  })

  it("does not leak another tenant's feedback", async () => {
    await listFeedback({ tenantId: "t1" })
    expect(db.ragFeedback.findMany.mock.calls[0][0].where.tenantId).toBe("t1")
  })
})