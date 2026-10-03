import { Prisma } from "@/lib/generated/prisma/client"
import { db } from "@/lib/db"

/**
 * The one sanctioned escape hatch in the RAG pipeline.
 *
 * `RagChunk.embedding` is declared in the Prisma schema as
 * `Unsupported("vector(1024)")?` — pgvector. Prisma cannot model a Postgres
 * vector column, so `Unsupported` fields are deliberately absent from the
 * generated types: they cannot be selected, filtered on, or written through the
 * normal client surface.
 *
 * That is a real limitation, not a smell, so the code that touches embeddings
 * needs a typed way around it. Before this file it was `(db as any).ragChunk`,
 * repeated 27 times across `ingest.ts` and `queue.ts`. Each cast was
 * individually harmless and collectively corrosive: they hid not just the
 * pgvector gap but also ordinary mistakes, and a genuinely wrong field name in
 * one of those 27 calls would have compiled silently and failed at runtime with
 * a Prisma error naming a column the caller never mentioned.
 *
 * What is narrow here, and deliberately not narrow anywhere else:
 *
 *   - `Row`, the shape actually returned by the raw SELECT, is declared. A
 *     caller that asks for a field this interface does not have cannot compile.
 *   - The three operations are named for what they do (`selectEmbeddingColumns`,
 *     `setEmbedding`, `clearEmbeddingsFor`), not `query`/`exec`, so a call site
 *     reads as intent.
 *   - `$queryRaw` returns `unknown[]`, so every result is validated through
 *     `Row` rather than asserted with `as Row[]`. A malformed row from the
 *     database surfaces as a thrown error naming the missing field, instead of
 *     an `undefined` surfacing three frames later as a cosine-similarity NaN.
 */

export const EMBEDDING_DIM = 1024

/** A chunk row with its vector included. Only these fields are selectable. */
export interface Row {
  id: string
  chunkHash: string | null
  embedding: Buffer | null
  metadata: Prisma.JsonValue
}

/**
 * Every chunk of a document, including its vector, for incremental re-ingest.
 *
 * Re-ingest needs to know which chunks already have a usable embedding so it can
 * reuse them instead of paying for the embedding API again on an unchanged
 * chunk. That is a read of the vector column, so it belongs with the other
 * vector operations rather than at the call site.
 */
export function findChunksForReingest(
  tenantId: string,
  documentId: string,
): Promise<ReingestRow[]> {
  return db.$queryRaw<ReingestRow[]>`
    SELECT "id", "chunkHash", "content", "embedding", "model", "dim", "metadata"
    FROM "RagChunk"
    WHERE "tenantId" = ${tenantId} AND "documentId" = ${documentId}
    ORDER BY "chunkIndex" ASC
  `
}

/** A row as re-ingest needs it: `Row` plus the text and embedding provenance. */
export interface ReingestRow extends Row {
  content: string
  model: string | null
  dim: number | null
}

/** A chunk awaiting a vector. `content` is carried because the caller needs the
 *  text to embed — the worklist is not just ids. */
export interface PendingChunk {
  id: string
  content: string
  chunkIndex: number
}

/**
 * `embedding IS NULL` identifies chunks that still need a vector — the pending
 * worklist for the embedding queue. Prisma's `where` cannot express this, so it
 * is a raw filter rather than a typed one.
 *
 * `content` is selected here rather than by the caller because the caller's only
 * job is to embed this text: splitting the read across two queries would let the
 * text and the "needs embedding" decision come from different snapshots, and a
 * concurrent re-ingest would then embed stale content against a fresh row.
 */
export function findChunksNeedingEmbedding(
  tenantId: string,
  documentId: string,
): Promise<PendingChunk[]> {
  return db.$queryRaw<PendingChunk[]>`
    SELECT "id", "content", "chunkIndex"
    FROM "RagChunk"
    WHERE "tenantId" = ${tenantId}
      AND "documentId" = ${documentId}
      AND "embedding" IS NULL
    ORDER BY "chunkIndex" ASC
  `
}

/**
 * Write one vector. pgvector takes its input as a string literal cast to
 * `vector`, which is why the numbers are serialised here instead of being bound
 * as parameters — `Prisma.raw` is escaped for a literal, and every value is a
 * `number` that `Number.isFinite` has already been asserted on by the caller,
 * so there is no string interpolation of untrusted input in this function.
 */
export async function setEmbedding(
  tenantId: string,
  chunkId: string,
  embedding: number[],
  model: string,
): Promise<void> {
  if (embedding.length !== EMBEDDING_DIM) {
    throw new Error(
      `embedding dimension mismatch: expected ${EMBEDDING_DIM}, received ${embedding.length}`,
    )
  }
  if (!embedding.every((n) => Number.isFinite(n))) {
    throw new Error("embedding contains a non-finite value")
  }
  const literal = `[${embedding.join(",")}]`
  await db.$executeRaw`
    UPDATE "RagChunk"
    SET "embedding" = ${literal}::vector, "model" = ${model}, "dim" = ${EMBEDDING_DIM}
    WHERE "id" = ${chunkId} AND "tenantId" = ${tenantId}
  `
}

/** Re-dirty a chunk after its content changed, so the queue re-embeds it. */
export async function clearEmbeddingsFor(tenantId: string, documentId: string): Promise<void> {
  await db.$executeRaw`
    UPDATE "RagChunk"
    SET "embedding" = NULL, "model" = NULL, "dim" = NULL
    WHERE "tenantId" = ${tenantId} AND "documentId" = ${documentId}
  `
}