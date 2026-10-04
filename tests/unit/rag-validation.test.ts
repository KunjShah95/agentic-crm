import { describe, it, expect } from "vitest"

import {
  ingestSchema,
  querySchema,
  feedbackSchema,
  bulkIngestSchema,
  syncSchema,
  ALLOWED_MIMES,
} from "@/modules/rag/validation"
import { detectModality } from "@/modules/rag/parsers"

/**
 * The RAG module's public entry point, and the only place untrusted input is
 * shaped before it reaches a database or a raw query. These schemas were untested,
 * so the defaults and limits below — the parts that decide what a caller can
 * actually do — were unpinned.
 */

describe("ingestSchema", () => {
  it("requires text or base64 content", () => {
    const result = ingestSchema.safeParse({ title: "Policy" })
    expect(result.success).toBe(false)
  })

  it("accepts text alone", () => {
    expect(ingestSchema.safeParse({ text: "Refund policy text" }).success).toBe(true)
  })

  it("accepts base64 content alone", () => {
    expect(ingestSchema.safeParse({ contentBase64: "QUJD" }).success).toBe(true)
  })

  /** Empty strings are the common client bug and must not count as content. */
  it("rejects empty strings as content", () => {
    expect(ingestSchema.safeParse({ text: "" }).success).toBe(false)
    expect(ingestSchema.safeParse({ contentBase64: "" }).success).toBe(false)
  })

  /**
   * Defaults are the security-relevant part: an ingest that omits `department`
   * lands in "general", and one that omits `confidential` is public to the whole
   * workspace. If either default flipped, documents would quietly become
   * *more* visible without any call site changing.
   */
  it("defaults to the general department", () => {
    const parsed = ingestSchema.parse({ text: "x" })
    expect(parsed.department).toBe("general")
  })

  it("defaults confidential to false and allowedRoles to empty", () => {
    const parsed = ingestSchema.parse({ text: "x" })
    expect(parsed.confidential).toBe(false)
    expect(parsed.allowedRoles).toEqual([])
    expect(parsed.tags).toEqual([])
  })

  it("rejects an unknown department", () => {
    expect(ingestSchema.safeParse({ text: "x", department: "engineering " }).success).toBe(false)
    expect(ingestSchema.safeParse({ text: "x", department: "nope" }).success).toBe(false)
  })

  it("rejects an authority outside 0..1", () => {
    expect(ingestSchema.safeParse({ text: "x", authority: 0.5 }).success).toBe(true)
    expect(ingestSchema.safeParse({ text: "x", authority: 1.5 }).success).toBe(false)
    expect(ingestSchema.safeParse({ text: "x", authority: -0.1 }).success).toBe(false)
  })

  it("rejects a role outside the known set", () => {
    expect(ingestSchema.safeParse({ text: "x", allowedRoles: ["OWNER"] }).success).toBe(true)
    expect(ingestSchema.safeParse({ text: "x", allowedRoles: ["SUPERUSER"] }).success).toBe(false)
  })

  it("caps the tag count and tag length", () => {
    const many = Array.from({ length: 21 }, (_, i) => `t${i}`)
    expect(ingestSchema.safeParse({ text: "x", tags: many }).success).toBe(false)
    expect(ingestSchema.safeParse({ text: "x", tags: ["a".repeat(61)] }).success).toBe(false)
  })

  it("rejects text beyond the size cap", () => {
    expect(ingestSchema.safeParse({ text: "a".repeat(200_001) }).success).toBe(false)
  })

  /**
   * `mime` is intentionally unvalidated — documented on `ALLOWED_MIMES`. Pinned so
   * that if it is ever wired up as a hard rejection, this test is what notices.
   */
  it("currently accepts an arbitrary mime type", () => {
    expect(ingestSchema.safeParse({ text: "x", mime: "application/x-nonsense" }).success).toBe(true)
    expect(ALLOWED_MIMES).toContain("application/pdf")
  })
})

describe("querySchema", () => {
  it("requires a non-empty query", () => {
    expect(querySchema.safeParse({ query: "" }).success).toBe(false)
    expect(querySchema.safeParse({}).success).toBe(false)
  })

  it("defaults topK to 8", () => {
    expect(querySchema.parse({ query: "refund?" }).topK).toBe(8)
  })

  /** `topK` is the result count and the candidate-pool size — an unbounded value is a DoS. */
  it("bounds topK to 1..50", () => {
    expect(querySchema.safeParse({ query: "q", topK: 0 }).success).toBe(false)
    expect(querySchema.safeParse({ query: "q", topK: 51 }).success).toBe(false)
    expect(querySchema.safeParse({ query: "q", topK: 1.5 }).success).toBe(false)
    expect(querySchema.safeParse({ query: "q", topK: 50 }).success).toBe(true)
  })

  it("bounds alpha to 0..1", () => {
    expect(querySchema.safeParse({ query: "q", alpha: 0 }).success).toBe(true)
    expect(querySchema.safeParse({ query: "q", alpha: 1 }).success).toBe(true)
    expect(querySchema.safeParse({ query: "q", alpha: 1.01 }).success).toBe(false)
  })

  /**
   * `departments` is a scope filter, so an unrecognised value must be rejected
   * rather than silently dropped. A dropped filter widens the result set: the
   * caller asked for one department and would receive the whole workspace.
   */
  it("rejects an unknown department rather than ignoring it", () => {
    expect(querySchema.safeParse({ query: "q", departments: ["sales"] }).success).toBe(false)
    expect(querySchema.safeParse({ query: "q", departments: ["legal"] }).success).toBe(true)
  })

  /**
   * Ids in this system are cuid, not uuid. The schema used to read
   * `uuid().or(min(1))`, which validated nothing — the second branch accepted
   * everything. Asserted so a future attempt to add a uuid check fails here first.
   */
  it("accepts cuid-shaped ids and rejects empty ones", () => {
    expect(querySchema.safeParse({ query: "q", documentIds: ["clx0abc123"] }).success).toBe(true)
    expect(querySchema.safeParse({ query: "q", documentIds: [""] }).success).toBe(false)
  })

  it("caps the document id count", () => {
    const ids = Array.from({ length: 21 }, (_, i) => `d${i}`)
    expect(querySchema.safeParse({ query: "q", documentIds: ids }).success).toBe(false)
  })

  it("rejects a query beyond the length cap", () => {
    expect(querySchema.safeParse({ query: "a".repeat(4001) }).success).toBe(false)
  })
})

describe("feedbackSchema", () => {
  it("accepts only +1 and -1", () => {
    expect(feedbackSchema.safeParse({ query: "q", rating: 1 }).success).toBe(true)
    expect(feedbackSchema.safeParse({ query: "q", rating: -1 }).success).toBe(true)
    expect(feedbackSchema.safeParse({ query: "q", rating: 0 }).success).toBe(false)
    expect(feedbackSchema.safeParse({ query: "q", rating: 5 }).success).toBe(false)
  })

  it("rejects a non-integer rating", () => {
    expect(feedbackSchema.safeParse({ query: "q", rating: 1.5 }).success).toBe(false)
  })
})

describe("bulkIngestSchema", () => {
  it("requires at least one item", () => {
    expect(bulkIngestSchema.safeParse({ items: [] }).success).toBe(false)
  })

  it("caps the batch at 100 items", () => {
    const items = Array.from({ length: 101 }, () => ({ text: "x" }))
    expect(bulkIngestSchema.safeParse({ items }).success).toBe(false)
  })

  it("rejects one bad item in an otherwise valid batch", () => {
    /* A single malformed row must fail the batch rather than being silently
       skipped — otherwise a caller is told 100 documents were queued when some
       subset was quietly dropped. */
    const result = bulkIngestSchema.safeParse({ items: [{ text: "ok" }, { text: "" }] })
    expect(result.success).toBe(false)
  })
})

describe("syncSchema", () => {
  it("requires an externalId on every item", () => {
    expect(syncSchema.safeParse({ items: [{ text: "x", externalId: "e1" }] }).success).toBe(true)
    expect(syncSchema.safeParse({ items: [{ text: "x" }] }).success).toBe(false)
    expect(syncSchema.safeParse({ items: [{ text: "x", externalId: "" }] }).success).toBe(false)
  })

  it("defaults the source", () => {
    const parsed = syncSchema.parse({ items: [{ text: "x", externalId: "e1" }] })
    expect(parsed.source).toBe("external")
  })

  it("caps the batch at 200 items", () => {
    const items = Array.from({ length: 201 }, (_, i) => ({ text: "x", externalId: `e${i}` }))
    expect(syncSchema.safeParse({ items }).success).toBe(false)
  })
})

describe("detectModality", () => {
  /**
   * Routing decides which extractor runs, and `parseText` is the fallback for
   * anything unrecognised — which for a binary buffer means `toString("utf8")` and
   * a document full of replacement characters in the corpus. So the fallback has to
   * be reached only for genuine text.
   */
  it("routes on the mime prefix", () => {
    expect(detectModality("image/png")).toBe("image")
    expect(detectModality("audio/mpeg")).toBe("audio")
    expect(detectModality("video/mp4")).toBe("video")
    expect(detectModality("application/pdf")).toBe("text")
  })

  it("falls back to the filename extension when mime is absent", () => {
    expect(detectModality("", "floor-plan.png")).toBe("image")
    expect(detectModality("", "handover.mp3")).toBe("audio")
    expect(detectModality("", "walkthrough.mp4")).toBe("video")
  })

  it("is case-insensitive on both mime and filename", () => {
    expect(detectModality("IMAGE/PNG")).toBe("image")
    expect(detectModality("", "FLOOR-PLAN.PNG")).toBe("image")
  })

  it("treats plain text documents as text", () => {
    expect(detectModality("text/plain", "notes.txt")).toBe("text")
    expect(detectModality("application/msword", "contract.doc")).toBe("text")
  })

  it("defaults to text rather than throwing on empty input", () => {
    expect(detectModality()).toBe("text")
    expect(detectModality("", "")).toBe("text")
  })
})