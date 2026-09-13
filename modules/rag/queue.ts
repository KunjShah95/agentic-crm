/**
 * Embedding Queue — In-Memory with Concurrency Control
 * For multi-instance deployments, swap for BullMQ/Redis.
 * Payloads are { tenantId, documentId } JSON — no caller changes needed.
 */

import { db } from "@/lib/db";
import { embed, embeddingModel } from "./providers/embeddings";
import { logger } from "@/lib/logger";

interface QueueItem {
  tenantId: string;
  documentId: string;
  retries: number;
  createdAt: number;
}

const CONCURRENCY = Number(process.env.RAG_EMBED_CONCURRENCY || 4);
const BATCH_SIZE = Number(process.env.RAG_EMBED_BATCH || 32);
const MAX_RETRIES = 3;

const queue: QueueItem[] = [];
const active = new Set<string>();
let processing = false;

function makeKey(item: QueueItem) {
  return `${item.tenantId}:${item.documentId}`;
}

export const enqueueIngest = ({ tenantId, documentId }: { tenantId: string; documentId: string }) => {
  const key = `${tenantId}:${documentId}`;
  if (active.has(key)) return;
  if (queue.some((q) => `${q.tenantId}:${q.documentId}` === key)) return;
  queue.push({ tenantId, documentId, retries: 0, createdAt: Date.now() });
  tick();
};

export const stats = () => ({
  active: active.size,
  pending: queue.length,
  done: 0,
  failed: 0,
});

async function tick() {
  if (processing) return;
  if (active.size >= CONCURRENCY) return;
  if (!queue.length) return;

  processing = true;
  while (queue.length && active.size < CONCURRENCY) {
    const item = queue.shift()!;
    const key = makeKey(item);
    if (active.has(key)) continue;
    active.add(key);
    processItem(item).finally(() => {
      active.delete(key);
      processing = false;
      tick();
    });
  }
  processing = false;
}

async function processItem(item: QueueItem) {
  const { tenantId, documentId, retries } = item;
  logger.info("rag/embed start", { tenantId, documentId, attempt: retries + 1 });

  try {
    const doc = await db.ragDocument.findFirst({
      where: { tenantId, id: documentId },
      select: { id: true, status: true, modality: true },
    });
    if (!doc) {
      logger.warn("rag/embed: document not found", { tenantId, documentId });
      return;
    }
    if (doc.status !== "PROCESSING") {
      logger.info("rag/embed: document not in processing state", { tenantId, documentId, status: doc.status });
      return;
    }

    const chunks = await db.ragChunk.findMany({
      where: { tenantId, documentId, embedding: null } as any,
      select: { id: true, content: true, chunkIndex: true },
      orderBy: { chunkIndex: "asc" },
    });
    if (!chunks.length) {
      await db.ragDocument.update({
        where: { id: documentId, tenantId },
        data: { status: "READY", updatedAt: new Date() },
      });
      logger.info("rag/embed: no chunks to embed, marked ready", { tenantId, documentId });
      return;
    }

    const model = embeddingModel();
    const dim = 1024;
    for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
      const batch = chunks.slice(i, i + BATCH_SIZE);
      const texts = batch.map((c) => c.content);
      const { vectors } = await embed(texts, { taskType: "passage" as const });

      await Promise.all(
        batch.map((c, j) =>
          db.ragChunk.update({
            where: { id: c.id, tenantId },
            data: { embedding: vectors[j], model, dim } as any,
          })
        )
      );
    }

    await db.ragDocument.update({
      where: { id: documentId, tenantId },
      data: { status: "READY", updatedAt: new Date() },
    });
    logger.info("rag/embed complete", { tenantId, documentId, chunks: chunks.length });
  } catch (e) {
    const err = e as Error;
    logger.error("rag/embed failed", { tenantId, documentId, error: err.message, retries });
    if (retries < MAX_RETRIES) {
      setTimeout(() => {
        queue.push({ ...item, retries: retries + 1 });
        tick();
      }, 5000 * (retries + 1));
    } else {
      await db.ragDocument
        .update({ where: { id: documentId, tenantId }, data: { status: "ERROR", error: err.message } })
        .catch(() => {});
    }
  }
}

if (typeof process !== "undefined") {
  process.on("SIGTERM", async () => {
    logger.info("rag/queue: draining...");
    while (active.size > 0 || queue.length > 0) {
      await new Promise((r) => setTimeout(r, 100));
    }
    await db.$disconnect();
  });
}