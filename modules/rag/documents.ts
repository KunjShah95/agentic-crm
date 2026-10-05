import { db } from "@/lib/db"
import { AppError } from "@/lib/errors"

/**
 * Read paths for `RagDocument`.
 *
 * Split out of `ingest.ts` because these two functions need nothing but `db`,
 * while `ingest.ts` transitively imports the parser graph — `parsers/index` pulls
 * in the PDF, DOCX, image, audio and video extractors, and `video.ffmpeg` shells
 * out — plus `queue` and `pgvector`.
 *
 * That matters for callers that only want to *list* documents. The knowledge-base
 * page reads this list to render a table, and importing `ingest.ts` for it drags
 * every one of those modules into the route's module graph. That is a build-graph
 * problem, not a style preference: with the heavy graph in the page, `next build`
 * crashed a page-data worker (`build worker exited with code: -1`) partway through
 * collecting routes, and succeeded with the page removed. Fewer modules in the
 * graph is the actual fix.
 *
 * `ingest.ts` re-exports both, so the REST routes and anything else importing
 * them from there keep working unchanged. One implementation, two entry points.
 */

const DOCUMENT_SELECT = {
  id: true,
  title: true,
  modality: true,
  status: true,
  lang: true,
  version: true,
  externalId: true,
  chunkCount: true,
  error: true,
  department: true,
  docType: true,
  tags: true,
  authority: true,
  confidential: true,
  allowedRoles: true,
  syncSource: true,
  syncCursor: true,
  createdAt: true,
  updatedAt: true,
} as const

/**
 * Every document for a tenant, newest first.
 *
 * `tenantId` is the whole predicate. There is no role filter here and that is
 * deliberate: this is a catalogue of what exists, not content. The `confidential`
 * and `allowedRoles` columns ride along so a UI can *label* a restricted document
 * without reading it — the gate that matters is in `retrieve.ts`, which excludes
 * restricted documents from retrieval, and `answerQuery`'s post-filter, which
 * excludes them again after scoring. Listing a document's title is not disclosing
 * its contents, and filtering the catalogue would leave a member unable to see
 * that a policy exists at all.
 */
export const listDocuments = async ({ tenantId }: { tenantId: string }) => {
  return db.ragDocument.findMany({
    where: { tenantId },
    select: DOCUMENT_SELECT,
    orderBy: { createdAt: "desc" },
  });
};

export const getDocument = async ({
  tenantId,
  documentId,
}: {
  tenantId: string;
  documentId: string;
}) => {
  const doc = await db.ragDocument.findFirst({
    where: { tenantId, id: documentId },
    select: DOCUMENT_SELECT,
  });
  if (!doc) throw new AppError("NOT_FOUND", "Document not found", 404);
  return doc;
};
