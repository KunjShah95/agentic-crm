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
    /* `authority: 1.0` puts a user-submitted correction at the maximum weight
       `scoreChunks` accepts — a flat 0.2 in the confidence formula, the largest
       contributor after retrieval itself — so it outranks the compliance documents
       it sits beside. `confidential` is left unset (false), so the correction is
       retrievable by the whole workspace.

       That may well be the intent: someone who knows the answer better than the
       document does is exactly who a correction comes from, and there is no review
       step. It is flagged rather than changed because lowering it is a product
       judgement, and picking a number here would quietly demote corrections in
       every tenant. What is worth an explicit decision is whether a tenant wants
       untrusted, unreviewed writes into a citation-backed corpus at maximum
       weight — and if so, whether corrections should instead be queued for review
       at normal authority and promoted on approval. */
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