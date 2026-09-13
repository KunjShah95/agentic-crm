/**
 * Feedback Service — Correction Loop
 * Rate answers, submit fixes that get promoted into the KB.
 */

import { db } from "@/lib/db";
import { ingestDocument } from "./ingest";
import { invalidateTenant } from "./cache";
import { semanticCache } from "./semantic-cache";

export interface FeedbackSubmitOptions {
  tenantId: string;
  userId: string;
  query: string;
  answer?: string;
  rating: 1 | -1;
  correction?: string;
  documentId?: string;
}

export const submitFeedback = async ({
  tenantId,
  userId,
  query,
  answer,
  rating,
  correction,
  documentId,
}: FeedbackSubmitOptions) => {
  const feedback = await db.ragFeedback.create({
    data: {
      tenantId,
      query,
      answer: answer || null,
      rating,
      correction: correction || null,
      documentId: documentId || null,
      createdBy: userId,
    },
  });

  if (correction) {
    await ingestDocument({
      tenantId,
      userId,
      file: {
        buffer: Buffer.from(correction, "utf8"),
        originalname: `correction-${Date.now()}.txt`,
        mimetype: "text/plain",
        size: Buffer.byteLength(correction, "utf8"),
      },
      title: `Correction: ${query.slice(0, 80)}`,
      department: "general",
      tags: ["correction", "feedback"],
      authority: 1.0,
    });
  }

  await invalidateTenant(tenantId);
  await semanticCache.invalidateScope(tenantId);

  return feedback;
};

export const listFeedback = async ({ tenantId }: { tenantId: string }) => {
  return db.ragFeedback.findMany({
    where: { tenantId },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
};