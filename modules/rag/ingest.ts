/**
 * Ingest Service — Document Ingestion Pipeline
 * Parse → Chunk → Insert → Queue for Embedding
 */

import crypto from "crypto";
import { db } from "@/lib/db";
import { AppError } from "@/lib/errors";
import { assertQuota, recordUsage } from "@/lib/usage";
import { parseFile } from "./parsers/index";
import { chunkText, detectLang } from "./chunk";
import { enqueueIngest } from "./queue";
import { invalidateDocuments } from "./cache";
import { semanticCache } from "./semantic-cache";
import { clearEmbeddingsFor, findChunksForReingest } from "./pgvector";
import type { Prisma } from "@/lib/generated/prisma/client";

/**
 * A JSON column is `Prisma.JsonValue`, which may hold a scalar or an array — so
 * it is not assignable to `Record<string, unknown>`. Callers that want a keyed
 * bag get an empty object instead of a cast that would let a non-object through
 * and fail on the first property access.
 */
const asObject = (v: Prisma.JsonValue | null | undefined): Record<string, unknown> =>
  v !== null && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};

const MAX_BYTES = Number(process.env.RAG_MAX_FILE_BYTES || 50 * 1024 * 1024);

const dominantLang = (chunks: Array<{ lang: string }>): string => {
  const counts: Record<string, number> = {};
  for (const c of chunks) counts[c.lang] = (counts[c.lang] || 0) + 1;
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] || "und";
};

const buildChunks = async ({
  tenantId,
  documentId,
  buffer,
  mimetype,
  originalname,
}: {
  tenantId: string;
  documentId: string;
  buffer: Buffer;
  mimetype: string;
  originalname: string;
}) => {
  const parsed = await parseFile({ buffer, mime: mimetype, filename: originalname });
  const chunks = chunkText(parsed.text);
  if (!chunks.length) throw new AppError("NO_TEXT", "No extractable text in file", 422);
  const lang = detectLang(parsed.text) || dominantLang(chunks);
  const rows = chunks.map((c) => ({
    tenantId,
    documentId,
    chunkIndex: c.chunk_index,
    chunkHash: c.chunk_hash || null,
    content: c.content,
    modality: parsed.modality.toUpperCase() as "TEXT" | "IMAGE" | "AUDIO" | "VIDEO",
    lang: c.lang,
    metadata: c.metadata,
  }));
  await (db as any).ragChunk.createMany({ data: rows });
  return { parsed, chunks, lang };
};

interface IngestDocumentOptions {
  tenantId: string;
  userId: string;
  file: {
    buffer: Buffer;
    originalname: string;
    mimetype: string;
    size: number;
  };
  title?: string;
  externalId?: string;
  department?: string;
  docType?: string | null;
  tags?: string[];
  authority?: number;
  confidential?: boolean;
  allowedRoles?: string[];
}

export const ingestDocument = async ({
  tenantId,
  userId,
  file,
  title,
  externalId,
  department = "general",
  docType = null,
  tags = [],
  authority = 1.0,
  confidential = false,
  allowedRoles = [],
}: IngestDocumentOptions) => {
  if (!file?.buffer) throw new AppError("FILE_REQUIRED", "File required", 400);
  if (file.size > MAX_BYTES) throw new AppError("FILE_TOO_LARGE", `File too large (max ${MAX_BYTES} bytes)`, 400);

  const mime = String(file.mimetype || "text/plain").split(";")[0].trim().toLowerCase();
  const name = String(file.originalname || "");
  const looksText = /\.(txt|md|markdown|html?|json|csv)$/i.test(name);
  const { ALLOWED_MIMES } = await import("./validation");
  if (!(ALLOWED_MIMES as readonly string[]).includes(mime) && !(mime === "application/octet-stream" && looksText) && mime !== "text/plain") {
    if (/executable|script|exe|dll|bat|sh$/.test(mime)) throw new AppError("UNSUPPORTED_TYPE", `Unsupported file type: ${mime}`, 415);
  }

  await assertQuota({ tenantId, event: "RAG_DOCS" });

  const content_hash = crypto.createHash("sha256").update(file.buffer).digest("hex");
  const existing = await (db as any).ragDocument.findFirst({
    where: { tenantId, contentHash: content_hash },
    select: { id: true, status: true },
  });
  if (existing) return { ...existing, deduped: true };

  if (externalId) {
    const byKey = await (db as any).ragDocument.findFirst({
      where: { tenantId, externalId },
      select: { id: true },
    });
    if (byKey) {
      return reingestDocument({
        tenantId,
        userId,
        documentId: byKey.id,
        file,
        title,
        externalId,
        department,
        docType,
        tags,
        authority,
        confidential,
        allowedRoles,
      });
    }
  }

  const source_file = `${tenantId}/rag/${Date.now()}-${file.originalname || "upload"}`;
  const doc = await (db as any).ragDocument.create({
    data: {
      tenantId,
      sourceFile: source_file,
      title: title || file.originalname || null,
      status: "PROCESSING",
      contentHash: content_hash,
      externalId: externalId || null,
      department,
      docType: docType || null,
      tags: tags || [],
      authority: authority ?? 1.0,
      confidential: !!confidential,
      allowedRoles: allowedRoles || [],
      createdBy: userId,
    },
    select: { id: true },
  });

  try {
    const { parsed, chunks, lang } = await buildChunks({
      tenantId,
      documentId: doc.id,
      buffer: file.buffer,
      mimetype: file.mimetype,
      originalname: file.originalname,
    });
    await (db as any).ragDocument.update({
      where: { id: doc.id },
      data: { modality: parsed.modality.toUpperCase() as "TEXT" | "IMAGE" | "AUDIO" | "VIDEO", lang, chunkCount: chunks.length, department, docType: docType || null, tags: tags || [], authority: authority ?? 1.0 },
    });
    await recordUsage({ tenantId, userId, event: "RAG_DOCS" });
    await invalidateDocuments(tenantId, [doc.id]);
    enqueueIngest({ tenantId, documentId: doc.id });
    return { id: doc.id, status: "PROCESSING" as const, modality: parsed.modality, lang, chunks: chunks.length };
  } catch (e) {
    const msg = (e as Error).message || "ingest failed";
    await (db as any).ragDocument.update({ where: { id: doc.id }, data: { status: "ERROR", error: msg } });
    if (e instanceof AppError) throw e;
    throw new AppError("INGEST_FAILED", `Ingest failed: ${msg}`, 422);
  }
};

interface ReingestOptions extends IngestDocumentOptions {
  documentId: string;
  mode?: "incremental" | "full";
}

export const reingestDocument = async ({
  tenantId,
  userId,
  documentId,
  file,
  title,
  externalId,
  department,
  docType,
  tags,
  authority,
  confidential,
  allowedRoles,
  mode = "incremental",
}: ReingestOptions) => {
  if (!file?.buffer) throw new AppError("FILE_REQUIRED", "File required", 400);
  if (file.size > MAX_BYTES) throw new AppError("FILE_TOO_LARGE", `File too large (max ${MAX_BYTES} bytes)`, 400);

  const doc = await (db as any).ragDocument.findFirst({
    where: { tenantId, id: documentId },
    select: { id: true, version: true, contentHash: true },
  });
  if (!doc) throw new AppError("NOT_FOUND", "Document not found", 404);

  const content_hash = crypto.createHash("sha256").update(file.buffer).digest("hex");
  if (doc.contentHash === content_hash) return { id: doc.id, deduped: true, version: doc.version ?? 1 };

  await assertQuota({ tenantId, event: "RAG_DOCS" });

  if (mode !== "full") {
    try {
      return await incrementalReingest({
        tenantId,
        userId,
        documentId,
        file,
        title,
        externalId,
        department,
        docType,
        tags,
        authority,
        confidential,
        allowedRoles,
        content_hash,
        baseVersion: doc.version ?? 1,
      });
    } catch (e) {
      if (e instanceof AppError) throw e;
    }
  }
  return fullReingest({
    tenantId,
    userId,
    documentId,
    file,
    title,
    externalId,
    department,
    docType,
    tags,
    authority,
    confidential,
    allowedRoles,
    content_hash,
    baseVersion: doc.version ?? 1,
  });
};

const incrementalReingest = async ({
  tenantId,
  userId,
  documentId,
  file,
  title,
  externalId,
  department,
  docType,
  tags,
  authority,
  confidential,
  allowedRoles,
  content_hash,
  baseVersion,
}: ReingestOptions & { content_hash: string; baseVersion: number }) => {
  const { parseFile: parse } = await import("./parsers/index");
  const { chunkText: chunk } = await import("./chunk");
  const parsed = await parse({ buffer: file.buffer, mime: file.mimetype, filename: file.originalname });
  const next = chunk(parsed.text);
  if (!next.length) throw new AppError("NO_TEXT", "No extractable text in file", 422);

  /* The old chunks, read through the pgvector accessor rather than
     `(db as any).ragChunk`: the `embedding` column is `Unsupported(...)` in the
     Prisma schema, so it cannot be selected through the typed client. See
     modules/rag/pgvector.ts for why that gap is real and why it is contained
     there instead of being cast away at 27 call sites. */
  const oldChunks = await findChunksForReingest(tenantId, documentId);

  const nextVersion = baseVersion + 1;
  await (db as any).ragDocument.update({
    where: { id: documentId, tenantId },
    data: {
      status: "PROCESSING",
      error: null,
      contentHash: content_hash,
      version: nextVersion,
      title: title ?? undefined,
      externalId: externalId ?? undefined,
      updatedAt: new Date(),
      ...(department ? { department } : {}),
      ...(docType !== undefined ? { docType } : {}),
      ...(tags ? { tags } : {}),
      ...(authority !== undefined ? { authority } : {}),
      ...(confidential !== undefined ? { confidential: !!confidential } : {}),
      ...(allowedRoles ? { allowedRoles } : {}),
    },
  });

  const lang = detectLang(parsed.text);

  const oldByHash = new Map<string, Array<{ id: string; chunkHash: string | null; embedding: Buffer | null; metadata: Record<string, unknown> }>>();
  for (const oc of oldChunks) {
    /* `metadata` arrives as `Prisma.JsonValue`, which is not assignable to
       `Record<string, unknown>` because a JSON column may legitimately hold a
       scalar or an array. Narrowing here rather than casting means a document
       whose metadata is not an object degrades to "no metadata" instead of
       throwing partway through the diff loop with a partially applied update. */
    const key = oc.chunkHash || "";
    const shaped = { ...oc, metadata: asObject(oc.metadata) };
    if (!oldByHash.has(key)) oldByHash.set(key, []);
    oldByHash.get(key)!.push(shaped);
  }

  const keepIds = new Set<string>();
  const reuseUpdates: Array<{ id: string; chunkIndex: number; metadata: Record<string, unknown> }> = [];
  const toInsert: Array<{
    tenantId: string;
    documentId: string;
    chunkIndex: number;
    chunkHash: string | null;
    content: string;
    modality: string;
    lang: string;
    metadata: Record<string, unknown>;
  }> = [];
  let reused = 0;
  let needsEmbed = false;

  next.forEach((c, i) => {
    const bucket = oldByHash.get(c.chunk_hash || "");
    const oc = bucket && bucket.shift();
    if (oc) {
      reused++;
      keepIds.add(oc.id);
      reuseUpdates.push({ id: oc.id, chunkIndex: i, metadata: c.metadata });
      if (!oc.embedding) needsEmbed = true;
    } else {
      toInsert.push({
        tenantId,
        documentId,
        chunkIndex: i,
        chunkHash: c.chunk_hash || null,
        content: c.content,
        modality: parsed.modality.toUpperCase() as "TEXT" | "IMAGE" | "AUDIO" | "VIDEO",
        lang: c.lang,
        metadata: c.metadata,
      });
    }
  });

  for (const u of reuseUpdates) {
    await (db as any).ragChunk.update({
      where: { id: u.id, tenantId },
      data: { chunkIndex: u.chunkIndex, metadata: u.metadata },
    });
  }

  const staleIds = oldChunks.map((o: any) => o.id).filter((id: string) => !keepIds.has(id));
  for (let i = 0; i < staleIds.length; i += 100) {
    const batch = staleIds.slice(i, i + 100);
    if (!batch.length) continue;
    await (db as any).ragChunk.deleteMany({
      where: { tenantId, documentId, id: { in: batch } },
    });
  }

  if (toInsert.length) {
    await (db as any).ragChunk.createMany({ data: toInsert });
  }

  await (db as any).ragDocument.update({
    where: { id: documentId },
    data: { modality: parsed.modality.toUpperCase() as "TEXT" | "IMAGE" | "AUDIO" | "VIDEO", lang, chunkCount: next.length },
  });
  await recordUsage({ tenantId, userId, event: "RAG_DOCS" });
  const inv = await invalidateDocuments(tenantId, [documentId]);
  await semanticCache.invalidateScope(tenantId);
  const requeue = toInsert.length > 0 || needsEmbed;
  if (requeue) enqueueIngest({ tenantId, documentId });
  else {
    await (db as any).ragDocument.update({
      where: { id: documentId, tenantId },
      data: { status: "READY", updatedAt: new Date() },
    });
  }
  return {
    id: documentId,
    status: requeue ? "PROCESSING" : "READY",
    version: nextVersion,
    modality: parsed.modality,
    lang,
    chunks: next.length,
    reused,
    embedded: toInsert.length,
    mode: "incremental",
    cache: inv.mode || "unknown",
  };
};

const fullReingest = async ({
  tenantId,
  userId,
  documentId,
  file,
  title,
  externalId,
  department,
  docType,
  tags,
  authority,
  confidential,
  allowedRoles,
  content_hash,
  baseVersion,
}: ReingestOptions & { content_hash: string; baseVersion: number }) => {
  const nextVersion = (baseVersion ?? 1) + 1;
  await (db as any).ragChunk.deleteMany({ where: { tenantId, documentId } });

  const nsPatch = {
    status: "PROCESSING" as const,
    error: null,
    contentHash: content_hash,
    version: nextVersion,
    title: title ?? undefined,
    externalId: externalId ?? undefined,
    updatedAt: new Date(),
    ...(department ? { department } : {}),
    ...(docType !== undefined ? { docType } : {}),
    ...(tags ? { tags } : {}),
    ...(authority !== undefined ? { authority } : {}),
    ...(confidential !== undefined ? { confidential: !!confidential } : {}),
    ...(allowedRoles ? { allowedRoles } : {}),
  };
  await (db as any).ragDocument.update({ where: { id: documentId, tenantId }, data: nsPatch });

  try {
    const { parsed, chunks, lang } = await buildChunks({
      tenantId,
      documentId,
      buffer: file.buffer,
      mimetype: file.mimetype,
      originalname: file.originalname,
    });
    await (db as any).ragDocument.update({
      where: { id: documentId },
      data: { modality: parsed.modality.toUpperCase() as "TEXT" | "IMAGE" | "AUDIO" | "VIDEO", lang, chunkCount: chunks.length },
    });
    await recordUsage({ tenantId, userId, event: "RAG_DOCS" });
    await invalidateDocuments(tenantId, [documentId]);
    await semanticCache.invalidateScope(tenantId);
    enqueueIngest({ tenantId, documentId });
    return { id: documentId, status: "PROCESSING" as const, version: nextVersion, modality: parsed.modality, lang, chunks: chunks.length, mode: "full" };
  } catch (e) {
    const msg = (e as Error).message || "re-ingest failed";
    await (db as any).ragDocument.update({ where: { id: documentId }, data: { status: "ERROR", error: msg } });
    if (e instanceof AppError) throw e;
    throw new AppError("REINGEST_FAILED", `Re-ingest failed: ${msg}`, 422);
  }
};

export const reindexTenant = async ({ tenantId }: { tenantId: string }) => {
  const docs = await (db as any).ragDocument.findMany({
    where: { tenantId },
    select: { id: true, status: true },
  });
  let queued = 0;
  for (const d of docs) {
    if (d.status === "PROCESSING") continue;
    /* Re-dirty the vectors so the queue re-embeds them. Through the pgvector
       accessor rather than `(db as any).ragChunk.updateMany`, because `embedding`
       is an `Unsupported` column — and because clearing a vector is not a generic
       "update many", it is a specific operation with a name that says what it
       does and clears `model` and `dim` alongside it. Leaving `model` set while
       the vector is null is what made the provenance column lie. */
    await clearEmbeddingsFor(tenantId, d.id);
    await (db as any).ragDocument.update({
      where: { id: d.id, tenantId },
      data: { status: "PROCESSING", updatedAt: new Date() },
    });
    enqueueIngest({ tenantId, documentId: d.id });
    queued++;
  }
  if (queued) await import("./cache").then(m => m.invalidateTenant(tenantId));
  await semanticCache.invalidateScope(tenantId);
  return { queued };
};

export const listDocuments = async ({ tenantId }: { tenantId: string }) => {
  const docs = await (db as any).ragDocument.findMany({
    where: { tenantId },
    select: {
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
    },
    orderBy: { createdAt: "desc" },
  });
  return docs;
};

export const getDocument = async ({ tenantId, documentId }: { tenantId: string; documentId: string }) => {
  const doc = await (db as any).ragDocument.findFirst({
    where: { tenantId, id: documentId },
    select: {
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
    },
  });
  if (!doc) throw new AppError("NOT_FOUND", "Document not found", 404);
  return doc;
};

export const deleteDocument = async ({ tenantId, documentId }: { tenantId: string; documentId: string }) => {
  const doc = await (db as any).ragDocument.findFirst({ where: { tenantId, id: documentId }, select: { id: true } });
  if (!doc) throw new AppError("NOT_FOUND", "Document not found", 404);
  await (db as any).ragDocument.delete({ where: { id: documentId, tenantId } });
  await invalidateDocuments(tenantId, [documentId]);
  await semanticCache.invalidateScope(tenantId);
  return { deleted: documentId };
};

export const bulkIngestDocuments = async ({
  tenantId,
  userId,
  items = [],
}: {
  tenantId: string;
  userId: string;
  items: Array<{
    title?: string;
    text?: string;
    contentBase64?: string;
    filename?: string;
    mime?: string;
    externalId?: string;
    department?: string;
    docType?: string | null;
    tags?: string[];
    authority?: number;
    confidential?: boolean;
    allowedRoles?: string[];
  }>;
}) => {
  if (!Array.isArray(items) || !items.length) throw new AppError("BAD_REQUEST", "items must be a non-empty array", 400);
  if (items.length > 100) throw new AppError("BAD_REQUEST", "Bulk limit is 100 documents per call", 400);
  const ok: Array<{ index: number; externalId: string | null; id: string; status: string; deduped?: boolean }> = [];
  const errors: Array<{ index: number; externalId: string | null; message: string }> = [];
  for (let i = 0; i < items.length; i++) {
    const it = items[i] || {};
    try {
      const buffer = it.text
        ? Buffer.from(String(it.text), "utf8")
        : it.contentBase64
          ? Buffer.from(String(it.contentBase64), "base64")
          : null;
      if (!buffer) throw new AppError("BAD_REQUEST", "Each item needs 'text' or 'contentBase64'", 400);
      const file = {
        buffer,
        originalname: it.filename || it.title || `bulk-${i}.txt`,
        mimetype: it.mime || "text/plain",
        size: buffer.length,
      };
      const res = await ingestDocument({
        tenantId,
        userId,
        file,
        title: it.title,
        externalId: it.externalId,
        department: it.department || "general",
        docType: it.docType || null,
        tags: it.tags || [],
        authority: it.authority ?? 1.0,
        confidential: !!it.confidential,
        allowedRoles: it.allowedRoles || [],
      });
      ok.push({ index: i, externalId: it.externalId || null, ...res });
    } catch (e) {
      errors.push({ index: i, externalId: it.externalId || null, message: (e as Error).message || "ingest failed" });
    }
  }
  return { ok, errors, total: items.length };
};

export const syncDocumentsByExternalId = async ({
  tenantId,
  userId,
  source = "external",
  items = [],
  cursor = null,
}: {
  tenantId: string;
  userId: string;
  source?: string;
  items: Array<{
    title?: string;
    text?: string;
    contentBase64?: string;
    filename?: string;
    mime?: string;
    externalId: string;
    department?: string;
    docType?: string | null;
    tags?: string[];
    authority?: number;
    confidential?: boolean;
    allowedRoles?: string[];
  }>;
  cursor?: string | null;
}) => {
  if (!Array.isArray(items) || !items.length) throw new AppError("BAD_REQUEST", "items must be a non-empty array", 400);
  if (items.length > 200) throw new AppError("BAD_REQUEST", "Sync limit is 200 documents per call", 400);
  let created = 0;
  let updated = 0;
  let unchanged = 0;
  const errors: Array<{ index: number; externalId: string | null; message: string }> = [];
  for (let i = 0; i < items.length; i++) {
    const it = items[i] || {};
    try {
      if (!it.externalId) throw new AppError("BAD_REQUEST", "Each sync item needs 'externalId'", 400);
      const buffer = it.text
        ? Buffer.from(String(it.text), "utf8")
        : it.contentBase64
          ? Buffer.from(String(it.contentBase64), "base64")
          : null;
      if (!buffer) throw new AppError("BAD_REQUEST", "Each sync item needs 'text' or 'contentBase64'", 400);
      const file = {
        buffer,
        originalname: it.filename || it.title || `${it.externalId}.txt`,
        mimetype: it.mime || "text/plain",
        size: buffer.length,
      };
      const existing = await (db as any).ragDocument.findFirst({
        where: { tenantId, externalId: it.externalId },
        select: { id: true },
      });
      let res;
      if (existing) {
        res = await reingestDocument({
          tenantId,
          userId,
          documentId: existing.id,
          file,
          title: it.title,
          externalId: it.externalId,
          department: it.department,
          docType: it.docType,
          tags: it.tags,
          authority: it.authority,
          confidential: it.confidential,
          allowedRoles: it.allowedRoles,
          mode: "incremental",
        });
        if ((res as any).deduped) unchanged++;
        else updated++;
      } else {
        res = await ingestDocument({
          tenantId,
          userId,
          file,
          title: it.title,
          externalId: it.externalId,
          department: it.department || "general",
          docType: it.docType || null,
          tags: it.tags || [],
          authority: it.authority ?? 1.0,
          confidential: !!it.confidential,
          allowedRoles: it.allowedRoles || [],
        });
        created++;
      }
      if (source || cursor) {
        await (db as any).ragDocument.update({
          where: { id: res.id || existing?.id, tenantId },
          data: {
            ...(source ? { syncSource: source } : {}),
            ...(cursor ? { syncCursor: cursor } : {}),
          },
        });
      }
    } catch (e) {
      errors.push({ index: i, externalId: it.externalId || null, message: (e as Error).message || "sync failed" });
    }
  }
  if (created > 0 || updated > 0) {
    await semanticCache.invalidateScope(tenantId);
  }
  return { created, updated, unchanged, errors, total: items.length, source, cursor };
};