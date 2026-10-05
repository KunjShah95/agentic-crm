"use server"

import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { handleAction, type Result } from "@/lib/actions"
import { AppError, PermissionError } from "@/lib/errors"
import { canManageData, canWriteCorpus, resolveViewerScope } from "@/lib/permissions"
import { revalidatePath } from "next/cache"
import { answerQuery } from "@/modules/rag/answer"
/* `deleteDocument` and `ingestDocument` are write paths and live in ./ingest with
   the parser graph they need. `listDocuments` comes from ./documents, which needs
   only `db`. */
import { deleteDocument, ingestDocument } from "@/modules/rag/ingest"
import { listDocuments } from "@/modules/rag/documents"
import { submitFeedback } from "@/modules/rag/feedback"
import { querySchema } from "@/modules/rag/validation"

/**
 * Knowledge-base actions: the in-app surface over `modules/rag`.
 *
 * ## Why these call the module directly instead of `/api/v1/.../rag/*`
 *
 * The REST surface authenticates with a workspace API key (`verifyApiKey`), which
 * is a credential for *integrations*. Nobody on a sales team holds one, so wiring
 * the UI to it would mean minting keys for human users — and a key is a bearer
 * token that does not expire with a session, does not carry a role, and cannot be
 * revoked when someone leaves the team. Calling `modules/rag` from an action that
 * has already resolved the session keeps all three properties.
 *
 * ## The one thing that must not be copied from the REST route
 *
 * `app/api/v1/tenants/[tenantId]/rag/query/route.ts` passes `role: null`. That is
 * correct there — an API key authenticates a tenant, not a person, so there is no
 * role to assert — and it means every document in the corpus is retrievable,
 * including the ones marked `confidential` with an `allowedRoles` list.
 *
 * Here there *is* a role, and dropping it would hand every member the
 * unrestricted view. `askKnowledgeAction` threads `scope.role` through to
 * `answerQuery`, which is what the `confidential` post-filter in `answer.ts` and
 * the SQL predicate in `retrieve.ts` both key off. Drop the argument and the
 * feature looks identical while quietly widening access.
 */

/** Membership + tenant, resolved once. `null` for a non-member. */
async function requireKnowledgeViewer(slug: string) {
  const session = await auth()
  const userId = session?.user?.id
  if (!userId) return null

  const ws = await db.workspace.findUnique({
    where: { slug },
    select: { id: true },
  })
  if (!ws) return null

  const scope = await resolveViewerScope(ws.id, userId)
  if (!scope) return null

  return { workspaceId: ws.id, userId, role: scope.role }
}

/** Corpus writers only. Throws rather than returning null: the caller is a member. */
async function requireCorpusWriter(slug: string) {
  const viewer = await requireKnowledgeViewer(slug)
  if (!viewer) throw new PermissionError("You're not a member of this workspace.")
  if (!canWriteCorpus(viewer.role)) {
    throw new PermissionError(
      "Your role can read the knowledge base but not add or remove documents."
    )
  }
  return viewer
}

/**
 * Deletes need `canManageData` (OWNER + ADMIN), not `canWriteCorpus`.
 *
 * Adding a document is additive; removing one is subtractive and, for everyone
 * else in the workspace, immediately destructive — every existing answer that
 * cited it now points at something the corpus no longer contains, and recovery
 * means re-uploading a file the workspace may not still hold.
 *
 * This also matches how the rest of the app splits the two: per the tenant-isolation
 * review, deletes gate on `canManageData` while creates gate on membership. Using
 * one predicate for both would have quietly widened deletion to every MEMBER.
 */
async function requireCorpusDeleter(slug: string) {
  const viewer = await requireKnowledgeViewer(slug)
  if (!viewer) throw new PermissionError("You're not a member of this workspace.")
  if (!canManageData(viewer.role)) {
    throw new PermissionError("Only an admin or the owner can remove documents.")
  }
  return viewer
}

/**
 * What the client is handed about one citation.
 *
 * Deliberately narrower than the engine's `citations` entry. `answerQuery` also
 * returns every retrieved chunk with its full `content`, and the full document
 * text is not needed to render a citation — but it *is* the confidential material
 * the role filter just protected. Trimming at the action boundary means the
 * restricted text is never serialised into the RSC payload at all, rather than
 * being filtered on arrival and relying on every future caller to remember.
 */
export type KnowledgeCitation = {
  source: number
  documentId: string
  title: string
  department: string | null
  confidence: number
  /** A short excerpt, so the answer can be checked without opening the document. */
  excerpt: string
}

export type KnowledgeAnswer = {
  answer: string
  refused: boolean
  citations: KnowledgeCitation[]
  /** Non-null when the faithfulness gate flagged claims it could not support. */
  warning: { type: string; claims: unknown[] } | null
  faithfulness: number
  confidence: { topConfidence: number; threshold: number; passed: boolean }
  intent: string
  scope: string | null
  cached: boolean
  cacheType?: string
  providerUsed?: string
}

const EXCERPT_CHARS = 320

function excerptOf(content: unknown): string {
  const text = typeof content === "string" ? content : ""
  return text.length > EXCERPT_CHARS ? `${text.slice(0, EXCERPT_CHARS).trimEnd()}…` : text
}

/**
 * `_prev` is the `useActionState` accumulator and is unused here.
 *
 * Its type is the state type, which is the whole `Result` union rather than the
 * unwrapped payload — so it must match what the component declares, or
 * `useActionState` rejects the reducer. Declaring it as the payload alone would
 * also be a lie: the action resolves to `{ data } | { error }`, and typing the
 * accumulator as the payload is how the error branch quietly stops being
 * reachable.
 */
export async function askKnowledgeAction(
  slug: string,
  _prev: Result<KnowledgeAnswer> | null,
  formData: FormData
): Promise<Result<KnowledgeAnswer>> {
  return handleAction(async () => {
    const viewer = await requireKnowledgeViewer(slug)
    if (!viewer) throw new PermissionError("You're not a member of this workspace.")

    const parsed = querySchema.safeParse({ query: formData.get("query") })
    if (!parsed.success) {
      throw new AppError("INVALID_QUERY", parsed.error.issues[0].message, 400)
    }

    const result = await answerQuery({
      tenantId: viewer.workspaceId,
      userId: viewer.userId,
      query: parsed.data.query,
      topK: parsed.data.topK,
      filter: {
        departments: parsed.data.departments,
        documentIds: parsed.data.documentIds,
        clause: parsed.data.clause,
        topK: parsed.data.topK,
      },
      /* The REST route sends null here. See the file header. */
      role: viewer.role,
    })

    /* Chunk content is matched to its citation by documentId, which is unique per
       citation only in the sense that a document can supply several chunks. The
       first chunk for a document is its excerpt: the engine ranked them, so that
       is the passage the answer actually leaned on. */
    const excerptByDoc = new Map<string, string>()
    for (const chunk of result.chunks ?? []) {
      if (!excerptByDoc.has(chunk.documentId)) {
        excerptByDoc.set(chunk.documentId, excerptOf(chunk.content))
      }
    }

    const citations: KnowledgeCitation[] = result.citations.map((c) => ({
      source: c.source,
      documentId: c.documentId,
      title: c.title ?? c.documentId,
      department: c.department ?? null,
      confidence: c.confidence,
      excerpt: excerptByDoc.get(c.documentId) ?? "",
    }))

    return {
      answer: result.answer,
      refused: result.refused,
      citations,
      warning: result.warning ?? null,
      faithfulness: result.faithfulness ?? 0,
      confidence: result.confidence,
      intent: result.intent,
      scope: result.scope ?? null,
      cached: Boolean(result.cached),
      cacheType: result.cacheType,
      providerUsed: result.providerUsed,
    }
  })
}

/**
 * Thumbs up / down. No correction box.
 *
 * `submitFeedback` ingests any `correction` as a new document at `authority: 1.0`
 * — the maximum `scoreChunks` accepts — with no review step, and `feedback.ts`
 * flags exactly that as an open product question. Exposing free-text corrections
 * from a UI would turn that open question into a live unreviewed write path into a
 * citation-backed corpus for every member, which is a decision to make
 * deliberately rather than by omission. Rating alone still feeds the loop.
 */
export async function rateKnowledgeAnswerAction(
  slug: string,
  query: string,
  answer: string,
  rating: 1 | -1
): Promise<Result<{ rated: true }>> {
  return handleAction(async () => {
    const viewer = await requireKnowledgeViewer(slug)
    if (!viewer) throw new PermissionError("You're not a member of this workspace.")
    if (!query.trim()) throw new AppError("INVALID_QUERY", "Nothing to rate.", 400)
    if (rating !== 1 && rating !== -1) {
      throw new AppError("INVALID_RATING", "Rating must be 1 or -1.", 400)
    }

    await submitFeedback({
      tenantId: viewer.workspaceId,
      userId: viewer.userId,
      query: query.slice(0, 4000),
      answer: answer.slice(0, 20_000),
      rating,
    })
    return { rated: true as const }
  })
}

export type KnowledgeDocument = {
  id: string
  title: string | null
  status: string
  modality: string | null
  lang: string | null
  chunkCount: number | null
  department: string | null
  docType: string | null
  confidential: boolean
  error: string | null
  createdAt: Date
}

export async function listKnowledgeDocumentsAction(slug: string): Promise<Result<KnowledgeDocument[]>> {
  return handleAction(async () => {
    const viewer = await requireKnowledgeViewer(slug)
    if (!viewer) throw new PermissionError("You're not a member of this workspace.")

    const docs = await listDocuments({ tenantId: viewer.workspaceId })
    return docs.map((d) => ({
      id: d.id,
      title: d.title,
      status: d.status,
      modality: d.modality,
      lang: d.lang,
      chunkCount: d.chunkCount,
      department: d.department,
      docType: d.docType,
      confidential: d.confidential,
      error: d.error,
      createdAt: d.createdAt,
    }))
  })
}

/**
 * Multipart upload.
 *
 * `ingestDocument` takes a multer-shaped `{ buffer, size, mimetype, originalname }`
 * because the REST routes receive one. A server action gets a web `File`, so the
 * adaptation is here rather than in the module — the module is shared with the
 * REST surface and should not grow a web-`File` branch for one caller.
 */
export type UploadSummary = { uploaded: number; skipped: number; failed: string[] }

/** `_prev` typed as the state union — see `askKnowledgeAction`. */
export async function uploadKnowledgeDocumentAction(
  slug: string,
  _prev: Result<UploadSummary> | null,
  formData: FormData
): Promise<Result<UploadSummary>> {
  return handleAction(async () => {
    const viewer = await requireCorpusWriter(slug)

    const files = formData.getAll("files").filter((f): f is File => f instanceof File)
    if (files.length === 0) {
      throw new AppError("NO_FILES", "Choose at least one file to add.", 400)
    }

    const department = String(formData.get("department") || "general")
    const confidential = formData.get("confidential") === "on"

    let uploaded = 0
    let skipped = 0
    const failed: string[] = []

    for (const file of files) {
      try {
        const result = await ingestDocument({
          tenantId: viewer.workspaceId,
          userId: viewer.userId,
          file: {
            buffer: Buffer.from(await file.arrayBuffer()),
            size: file.size,
            mimetype: file.type,
            originalname: file.name,
          },
          title: file.name,
          /* `DEPARTMENTS` in modules/rag/validation.ts is the source of truth; an
             unrecognised value falls back rather than failing the whole batch. */
          department: (["general", "hr", "marketing", "finance", "legal", "engineering", "support"] as const)
            .find((d) => d === department) ?? "general",
          confidential,
        })
        /* `deduped` means the same bytes are already in the corpus. Counted
           separately from a failure: the row is there, nothing needs re-uploading,
           and reporting it as an error would train people to ignore the list.

           Narrowed with `in` rather than `result.deduped` because `ingestDocument`
           returns four shapes — a dedupe hit, a re-ingest, a fresh ingest, and the
           create path — and only the dedupe hit carries the flag. Reading the
           property directly is a compile error on the union, which is the correct
           pressure: it means the check has to acknowledge which branch it is in. */
        if ("deduped" in result && result.deduped) skipped++
        else uploaded++
      } catch (err) {
        failed.push(
          `${file.name} — ${err instanceof AppError ? err.message : "could not be read"}`
        )
      }
    }

    revalidatePath(`/${slug}/knowledge`)
    /* Not a success toast when something failed — see the import dialog, which had
       the same bug: a summary that reads clean while rows were never written. */
    return { uploaded, skipped, failed }
  })
}

export async function deleteKnowledgeDocumentAction(
  slug: string,
  documentId: string
): Promise<Result<{ deleted: true }>> {
  return handleAction(async () => {
    const viewer = await requireCorpusDeleter(slug)

    /* Scoped by tenant inside the module, so a foreign id reads as not-found
       rather than deleting another workspace's document. */
    await deleteDocument({ tenantId: viewer.workspaceId, documentId })
    revalidatePath(`/${slug}/knowledge`)
    return { deleted: true as const }
  })
}
