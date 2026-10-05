import { describe, it, expect, vi, beforeEach } from "vitest"

/**
 * The knowledge-base actions: tenant and role gating.
 *
 * ## What is actually being protected
 *
 * `modules/rag` reads documents that can be marked `confidential` with an
 * `allowedRoles` list, and both the SQL predicate in `retrieve.ts` and the
 * post-filter in `answer.ts` key off the `role` argument. Every caller of
 * `answerQuery` therefore decides who can read what.
 *
 * The REST route passes `role: null`, which is correct there — an API key
 * authenticates a tenant, not a person, so there is no role to assert — and it
 * means every document in the corpus is retrievable. `askKnowledgeAction` is the
 * first caller that *has* a role, so it is the first place the value can be
 * threaded or dropped. Dropping it does not fail: the feature renders, answers
 * arrive, citations resolve. It just quietly hands every member the unrestricted
 * view. Hence a test that asserts the argument, not the rendering.
 *
 * The second property is that a non-member learns nothing. `resolveViewerScope`
 * returns `null` rather than throwing, so a caller that forgets to check it gets
 * `null` where it expected a workspace id — which is a crash, not a leak, but a
 * crash at the wrong place. So both are asserted.
 */

const db = vi.hoisted(() => ({
  workspace: { findUnique: vi.fn() },
}))
const auth = vi.hoisted(() => vi.fn())
const resolveViewerScope = vi.hoisted(() => vi.fn())
const answerQuery = vi.hoisted(() => vi.fn())
const ingestDocument = vi.hoisted(() => vi.fn())
const deleteDocument = vi.hoisted(() => vi.fn())
const listDocuments = vi.hoisted(() => vi.fn())
const submitFeedback = vi.hoisted(() => vi.fn())
const revalidatePath = vi.hoisted(() => vi.fn())

vi.mock("@/lib/db", () => ({ db }))
vi.mock("@/lib/auth", () => ({ auth }))
vi.mock("@/lib/permissions", async (orig) => ({
  ...(await orig<typeof import("@/lib/permissions")>()),
  resolveViewerScope,
}))
vi.mock("@/modules/rag/answer", () => ({ answerQuery }))
vi.mock("@/modules/rag/ingest", () => ({ ingestDocument, deleteDocument, listDocuments }))
vi.mock("@/modules/rag/feedback", () => ({ submitFeedback }))
vi.mock("next/cache", () => ({ revalidatePath }))

const { askKnowledgeAction, uploadKnowledgeDocumentAction, deleteKnowledgeDocumentAction, rateKnowledgeAnswerAction } =
  await import("@/lib/actions/knowledge")
const { canWriteCorpus } = await import("@/lib/permissions")

const SLUG = "acme"

/** A minimal answer shaped like the engine's, with one citation and one chunk. */
function answerFixture(overrides: Record<string, unknown> = {}) {
  return {
    answer: "Refunds are processed within 15 days.",
    refused: false,
    citations: [
      {
        source: 1,
        documentId: "doc1",
        title: "Refund policy",
        department: "legal",
        metadata: {},
        confidence: 0.82,
      },
    ],
    warning: null,
    faithfulness: 0.9,
    confidence: { topConfidence: 0.82, threshold: 0.65, passed: true },
    scope: null,
    intent: "factual",
    attempts: 1,
    chunks: [{ documentId: "doc1", content: "Refunds are processed within 15 days.", metadata: {} }],
    ...overrides,
  }
}

function asMember(role: string) {
  auth.mockResolvedValue({ user: { id: "u1" } })
  db.workspace.findUnique.mockResolvedValue({ id: "w1" })
  resolveViewerScope.mockResolvedValue({ workspaceId: "w1", role, brokerId: null })
}

beforeEach(() => {
  db.workspace.findUnique.mockReset().mockResolvedValue({ id: "w1" })
  resolveViewerScope.mockReset().mockResolvedValue({ workspaceId: "w1", role: "MEMBER", brokerId: null })
  auth.mockReset().mockResolvedValue({ user: { id: "u1" } })
  answerQuery.mockReset().mockResolvedValue(answerFixture())
  ingestDocument.mockReset().mockResolvedValue({ id: "doc1", status: "PROCESSING" })
  deleteDocument.mockReset().mockResolvedValue({ deleted: "doc1" })
  listDocuments.mockReset().mockResolvedValue([])
  submitFeedback.mockReset().mockResolvedValue({ id: "fb1" })
  revalidatePath.mockReset()
})

/**
 * `new FormData()` plus `append`, not `new FormData([[k, v]])`.
 *
 * The array form is the WHATWG/undici constructor signature; under vitest's jsdom
 * environment `FormData` is jsdom's, whose constructor takes an `HTMLFormElement`
 * and throws on anything else. `append` is the one method both implementations
 * agree on, which is all a server action receives in practice.
 */
function formWith(file?: File, extra: Record<string, string> = {}) {
  const fd = new FormData()
  if (file) fd.append("files", file)
  for (const [k, v] of Object.entries(extra)) fd.append(k, v)
  return fd
}

function formWithQuery(query: string) {
  const fd = new FormData()
  fd.append("query", query)
  return fd
}

const ask = (query = "refund window?") => askKnowledgeAction(SLUG, null, formWithQuery(query))

describe("canWriteCorpus", () => {
  /**
   * The whole reason this is an explicit list rather than
   * `requireWorkspaceMember(ws, user, "MEMBER")`: `ROLE_RANK` puts VIEWER, BROKER,
   * MEMBER and SALES all at 0, so a `minRole` of MEMBER admits a VIEWER. This
   * test is the record of that, so nobody "simplifies" the list back to a rank
   * comparison and silently reopens write access to read-only accounts.
   */
  it("admits the roles that work here and no others", () => {
    expect(canWriteCorpus("OWNER")).toBe(true)
    expect(canWriteCorpus("ADMIN")).toBe(true)
    expect(canWriteCorpus("MEMBER")).toBe(true)
    expect(canWriteCorpus("SALES")).toBe(true)
  })

  it("refuses read-only and broker accounts", () => {
    expect(canWriteCorpus("VIEWER")).toBe(false)
    expect(canWriteCorpus("BROKER")).toBe(false)
  })
})

describe("askKnowledgeAction", () => {
  it("passes the caller's role to the engine, not null", async () => {
    asMember("ADMIN")
    await ask()

    expect(answerQuery).toHaveBeenCalledTimes(1)
    const arg = answerQuery.mock.calls[0][0]
    /* The assertion that matters. `role: null` is what the REST route sends and
       it disables every confidential-document filter downstream. */
    expect(arg.role).toBe("ADMIN")
  })

  it("gives a VIEWER their own role rather than an unrestricted one", async () => {
    asMember("VIEWER")
    await ask()

    expect(answerQuery.mock.calls[0][0].role).toBe("VIEWER")
  })

  it("scopes retrieval to the caller's own workspace", async () => {
    asMember("MEMBER")
    await ask()

    expect(answerQuery.mock.calls[0][0].tenantId).toBe("w1")
  })

  it("returns the error union rather than throwing at a non-member", async () => {
    resolveViewerScope.mockResolvedValue(null)
    const result = await ask()

    expect(result.error?.code).toBe("FORBIDDEN")
    expect(answerQuery).not.toHaveBeenCalled()
  })

  it("returns the error union when there is no session", async () => {
    auth.mockResolvedValue(null)
    const result = await ask()

    expect(result.error?.code).toBe("FORBIDDEN")
    expect(answerQuery).not.toHaveBeenCalled()
  })

  it("rejects an empty question before reaching the engine", async () => {
    asMember("MEMBER")
    const result = await ask("")

    expect(result.error?.code).toBe("INVALID_QUERY")
    expect(answerQuery).not.toHaveBeenCalled()
  })

  /**
   * The restricted material is trimmed at the action boundary rather than in the
   * component. `answerQuery` returns every retrieved chunk's full `content`, which
   * for a role-filtered document is the very text the filter just protected —
   * serialising it into the RSC payload and relying on the client not to render it
   * would put the confidential text in the browser either way.
   */
  it("sends an excerpt, not the whole chunk, to the client", async () => {
    asMember("ADMIN")
    answerQuery.mockResolvedValue(
      answerFixture({
        chunks: [{ documentId: "doc1", content: "x".repeat(5000), metadata: {} }],
      })
    )

    const result = await ask()
    const citation = result.data?.citations[0]

    expect(citation?.excerpt.length).toBeLessThan(400)
    expect(citation?.excerpt.endsWith("…")).toBe(true)
  })

  it("carries a refusal through without inventing citations", async () => {
    asMember("MEMBER")
    answerQuery.mockResolvedValue(
      answerFixture({
        answer: "I don't know.",
        refused: true,
        citations: [],
        chunks: [],
        confidence: { topConfidence: 0.2, threshold: 0.65, passed: false },
      })
    )

    const result = await ask()

    expect(result.data?.refused).toBe(true)
    expect(result.data?.citations).toEqual([])
  })

  it("surfaces an unverified-claims warning", async () => {
    asMember("MEMBER")
    answerQuery.mockResolvedValue(
      answerFixture({ warning: { type: "unverified_claims", claims: ["a claim"] } })
    )

    const result = await ask()

    expect(result.data?.warning?.type).toBe("unverified_claims")
  })
})

describe("rateKnowledgeAnswerAction", () => {
  /**
   * No correction path. `submitFeedback` ingests a `correction` as a new document
   * at `authority: 1.0` with no review step, which `feedback.ts` flags as an open
   * product question. This suite asserts the action never sends one, so exposing
   * that write path becomes a deliberate change to this file rather than a field
   * added to a form.
   */
  it("records a rating without ingesting a correction", async () => {
    asMember("MEMBER")
    await rateKnowledgeAnswerAction(SLUG, "refund window?", "15 days", 1)

    expect(submitFeedback).toHaveBeenCalledTimes(1)
    const arg = submitFeedback.mock.calls[0][0]
    expect(arg.rating).toBe(1)
    expect(arg.tenantId).toBe("w1")
    expect("correction" in arg && arg.correction).toBeFalsy()
  })

  it("refuses a rating that is not 1 or -1", async () => {
    asMember("MEMBER")
    const result = await rateKnowledgeAnswerAction(SLUG, "q", "a", 0 as unknown as 1)

    expect(result.error?.code).toBe("INVALID_RATING")
    expect(submitFeedback).not.toHaveBeenCalled()
  })

  it("lets a VIEWER rate", async () => {
    asMember("VIEWER")
    const result = await rateKnowledgeAnswerAction(SLUG, "q", "a", -1)

    expect(result.error).toBeUndefined()
    expect(submitFeedback).toHaveBeenCalledTimes(1)
  })
})

describe("uploadKnowledgeDocumentAction", () => {
  it("adapts a web File into the shape ingestDocument expects", async () => {
    asMember("MEMBER")
    const file = new File(["hello world"], "policy.txt", { type: "text/plain" })

    await uploadKnowledgeDocumentAction(SLUG, null, formWith(file))

    expect(ingestDocument).toHaveBeenCalledTimes(1)
    const arg = ingestDocument.mock.calls[0][0]
    expect(Buffer.isBuffer(arg.file.buffer)).toBe(true)
    expect(arg.file.buffer.toString()).toBe("hello world")
    expect(arg.file.originalname).toBe("policy.txt")
    expect(arg.file.mimetype).toBe("text/plain")
    expect(arg.file.size).toBe(11)
  })

  it("scopes the write to the caller's workspace", async () => {
    asMember("MEMBER")
    await uploadKnowledgeDocumentAction(
      SLUG,
      null,
      formWith(new File(["x"], "a.txt", { type: "text/plain" }))
    )

    expect(ingestDocument.mock.calls[0][0].tenantId).toBe("w1")
  })

  it("refuses a VIEWER", async () => {
    asMember("VIEWER")
    const result = await uploadKnowledgeDocumentAction(
      SLUG,
      null,
      formWith(new File(["x"], "a.txt", { type: "text/plain" }))
    )

    expect(result.error?.code).toBe("FORBIDDEN")
    expect(ingestDocument).not.toHaveBeenCalled()
  })

  it("refuses when no file was chosen", async () => {
    asMember("MEMBER")
    const result = await uploadKnowledgeDocumentAction(SLUG, null, formWith())

    expect(result.error?.code).toBe("NO_FILES")
    expect(ingestDocument).not.toHaveBeenCalled()
  })

  /**
   * A failed batch must not be reported as a clean upload. This is the same defect
   * the CSV import dialog had: valid rows counted as created while whole batches
   * failed, so the summary read as success.
   */
  it("counts a rejected file separately from one that was added", async () => {
    asMember("MEMBER")
    ingestDocument
      .mockResolvedValueOnce({ id: "doc1", status: "PROCESSING" })
      .mockRejectedValueOnce(new Error("boom"))

    const fd = new FormData()
    fd.append("files", new File(["a"], "a.txt", { type: "text/plain" }))
    fd.append("files", new File(["b"], "b.txt", { type: "text/plain" }))

    const result = await uploadKnowledgeDocumentAction(SLUG, null, fd)

    expect(ingestDocument).toHaveBeenCalledTimes(2)
    expect(result.data?.uploaded).toBe(1)
    expect(result.data?.failed).toHaveLength(1)
    expect(result.data?.failed[0]).toContain("b.txt")
  })

  /** Same bytes already in the corpus: not a failure, and not a second copy. */
  it("counts a duplicate as skipped rather than uploaded", async () => {
    asMember("MEMBER")
    ingestDocument.mockResolvedValue({ id: "doc1", status: "READY", deduped: true })

    const result = await uploadKnowledgeDocumentAction(
      SLUG,
      null,
      formWith(new File(["a"], "a.txt", { type: "text/plain" }))
    )

    expect(result.data?.uploaded).toBe(0)
    expect(result.data?.skipped).toBe(1)
    expect(result.data?.failed).toEqual([])
  })

  it("marks a confidential upload as restricted", async () => {
    asMember("ADMIN")
    await uploadKnowledgeDocumentAction(
      SLUG,
      null,
      formWith(new File(["a"], "a.txt", { type: "text/plain" }), { confidential: "on" })
    )

    expect(ingestDocument.mock.calls[0][0].confidential).toBe(true)
  })

  it("falls back to general for a department it does not recognise", async () => {
    asMember("MEMBER")
    await uploadKnowledgeDocumentAction(
      SLUG,
      null,
      formWith(new File(["a"], "a.txt", { type: "text/plain" }), { department: "<script>" })
    )

    expect(ingestDocument.mock.calls[0][0].department).toBe("general")
  })
})

describe("deleteKnowledgeDocumentAction", () => {
  it("scopes the delete to the caller's workspace", async () => {
    asMember("ADMIN")
    await deleteKnowledgeDocumentAction(SLUG, "doc1")

    expect(deleteDocument).toHaveBeenCalledWith({ tenantId: "w1", documentId: "doc1" })
  })

  it("refuses a MEMBER", async () => {
    asMember("MEMBER")
    const result = await deleteKnowledgeDocumentAction(SLUG, "doc1")

    expect(result.error?.code).toBe("FORBIDDEN")
    expect(deleteDocument).not.toHaveBeenCalled()
  })

  it("refuses a VIEWER", async () => {
    asMember("VIEWER")
    const result = await deleteKnowledgeDocumentAction(SLUG, "doc1")

    expect(result.error?.code).toBe("FORBIDDEN")
    expect(deleteDocument).not.toHaveBeenCalled()
  })
})
