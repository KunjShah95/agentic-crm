/**
 * RAG Module Validation Schemas
 * Zod schemas for request validation
 */

import { z } from "zod";
import { Department, Role } from "./types";

const DEPARTMENTS = [
  "general",
  "hr",
  "marketing",
  "finance",
  "legal",
  "engineering",
  "support",
] as const;

const ROLES = ["OWNER", "ADMIN", "MEMBER", "VIEWER"] as const;

// Allow-listed mimes: text + office + image + audio + video
export const ALLOWED_MIMES = [
  "text/plain",
  "text/markdown",
  "text/html",
  "application/json",
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
  "audio/mpeg",
  "audio/wav",
  "audio/mp4",
  "audio/ogg",
  "video/mp4",
  "video/webm",
  "video/quicktime",
] as const;

export const ingestSchema = z
  .object({
    title: z.string().max(300).optional(),
    text: z.string().min(1).max(200_000).optional(),
    contentBase64: z.string().min(1).max(70_000_000).optional(),
    filename: z.string().max(300).optional(),
    mime: z.string().max(150).optional(),
    externalId: z.string().max(300).optional(),
    department: z.enum(DEPARTMENTS).optional().default("general"),
    docType: z.string().max(100).optional(),
    tags: z.array(z.string().max(60)).max(20).optional().default([]),
    authority: z.number().min(0).max(1).optional(),
    confidential: z.boolean().optional().default(false),
    allowedRoles: z.array(z.enum(ROLES)).max(4).optional().default([]),
  })
  .refine((d) => d.text || d.contentBase64, {
    message: "Provide either 'text' or 'contentBase64'",
  });

export const querySchema = z.object({
  query: z.string().min(1).max(4000),
  topK: z.number().int().min(1).max(50).optional().default(8),
  alpha: z.number().min(0).max(1).optional(),
  departments: z.array(z.enum(DEPARTMENTS)).max(10).optional(),
  documentIds: z.array(z.string().uuid().or(z.string().min(1))).max(20).optional(),
  clause: z.string().max(40).optional(),
  context: z.string().max(4000).optional(),
});

export const feedbackSchema = z.object({
  query: z.string().min(1).max(4000),
  answer: z.string().max(20_000).optional(),
  rating: z.number().int().refine((v) => v === 1 || v === -1, {
    message: "rating must be 1 or -1",
  }),
  correction: z.string().min(1).max(20_000).optional(),
  documentId: z.string().optional(),
});

const bulkItemSchema = z.object({
  title: z.string().max(300).optional(),
  text: z.string().min(1).max(200_000).optional(),
  contentBase64: z.string().min(1).max(70_000_000).optional(),
  filename: z.string().max(300).optional(),
  mime: z.string().max(150).optional(),
  externalId: z.string().max(300).optional(),
  department: z.enum(DEPARTMENTS).optional().default("general"),
  docType: z.string().max(100).optional(),
  tags: z.array(z.string().max(60)).max(20).optional().default([]),
  authority: z.number().min(0).max(1).optional(),
  confidential: z.boolean().optional().default(false),
  allowedRoles: z.array(z.enum(ROLES)).max(4).optional().default([]),
});

export const bulkIngestSchema = z.object({
  items: bulkItemSchema.array().min(1).max(100),
});

export const syncSchema = z.object({
  source: z.string().max(100).optional().default("external"),
  cursor: z.string().max(300).optional(),
  items: bulkItemSchema
    .extend({ externalId: z.string().min(1).max(300) })
    .array()
    .min(1)
    .max(200),
});

export type IngestInput = z.infer<typeof ingestSchema>;
export type QueryInput = z.infer<typeof querySchema>;
export type FeedbackInput = z.infer<typeof feedbackSchema>;
export type BulkIngestInput = z.infer<typeof bulkIngestSchema>;
export type SyncInput = z.infer<typeof syncSchema>;