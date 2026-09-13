/**
 * RAG Module Types
 * Production-level type definitions for the Retrieval-Augmented Generation system
 */

export type Department =
  | "general"
  | "hr"
  | "marketing"
  | "finance"
  | "legal"
  | "engineering"
  | "support";

export type Role = "OWNER" | "ADMIN" | "MEMBER" | "VIEWER";

export type DocumentStatus = "processing" | "ready" | "error";

export type Modality = "text" | "image" | "audio" | "video";

export interface IngestDocumentInput {
  tenantId: string;
  userId: string;
  file: FileInput;
  title?: string;
  externalId?: string;
  department?: Department;
  docType?: string | null;
  tags?: string[];
  authority?: number;
  confidential?: boolean;
  allowedRoles?: Role[];
}

export interface FileInput {
  buffer: Buffer;
  originalname: string;
  mimetype: string;
  size: number;
}

export interface ReingestDocumentInput extends IngestDocumentInput {
  documentId: string;
  mode?: "incremental" | "full";
}

export interface QueryInput {
  tenantId: string;
  userId: string;
  query: string;
  topK?: number;
  alpha?: number;
  filter?: QueryFilter;
  role?: Role | null;
  context?: string | null;
}

export interface QueryFilter {
  departments?: Department[];
  documentIds?: string[];
  clause?: string;
  topK?: number;
}

export interface QueryResult {
  answer: string;
  refused: boolean;
  citations: Citation[];
  warning?: { type: string; claims: string[] };
  faithfulness: number;
  confidence: ConfidenceResult;
  providerUsed?: string;
  scope: string | null;
  intent: string;
  attempts: number;
  chunks: ChunkResult[];
  cached?: boolean;
  cacheType?: "exact" | "semantic";
}

export interface ConfidenceResult {
  topConfidence: number;
  threshold: number;
  passed: boolean;
  components?: {
    retrievalScore: number;
    freshness: number;
    authority: number;
    agreement: number;
  };
}

export interface Citation {
  source: number;
  documentId: string;
  title?: string;
  department?: string;
  metadata?: Record<string, unknown>;
  confidence: number;
}

export interface ChunkResult {
  documentId: string;
  content: string;
  score: number;
  metadata?: Record<string, unknown>;
}

export interface FeedbackInput {
  query: string;
  answer?: string;
  rating: 1 | -1;
  correction?: string;
  documentId?: string;
}

export interface FeedbackResult {
  id: string;
  query: string;
  rating: 1 | -1;
  correction?: string;
  documentId?: string;
  createdAt: Date;
}

export interface DocumentResult {
  id: string;
  title: string | null;
  modality: Modality;
  status: DocumentStatus;
  lang: string;
  version: number;
  externalId: string | null;
  chunkCount: number;
  error: string | null;
  department: Department;
  docType: string | null;
  tags: string[];
  authority: number;
  confidential: boolean;
  allowedRoles: Role[];
  syncSource: string | null;
  syncCursor: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface BulkIngestInput {
  items: BulkItemInput[];
}

export interface BulkItemInput {
  title?: string;
  text?: string;
  contentBase64?: string;
  filename?: string;
  mime?: string;
  externalId?: string;
  department?: Department;
  docType?: string | null;
  tags?: string[];
  authority?: number;
  confidential?: boolean;
  allowedRoles?: Role[];
}

export interface BulkIngestResult {
  ok: Array<{ index: number; externalId: string | null; id: string; status: string; deduped?: boolean }>;
  errors: Array<{ index: number; externalId: string | null; message: string }>;
  total: number;
}

export interface SyncInput {
  source?: string;
  cursor?: string;
  items: SyncItemInput[];
}

export interface SyncItemInput extends BulkItemInput {
  externalId: string;
}

export interface SyncResult {
  created: number;
  updated: number;
  unchanged: number;
  errors: Array<{ index: number; externalId: string | null; message: string }>;
  total: number;
  source?: string;
  cursor?: string;
}

export interface ReindexResult {
  queued: number;
  queue: { active: number; pending: number; done: number; failed: number };
}

export interface IngestDocumentResult {
  id: string;
  status: DocumentStatus;
  modality: Modality;
  lang: string;
  chunks: number;
  deduped?: boolean;
  version?: number;
  reused?: number;
  embedded?: number;
  mode?: "incremental" | "full";
  cache?: { invalidated: boolean; mode: string };
}