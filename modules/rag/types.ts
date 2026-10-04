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

/**
 * What `scoreChunks` actually returns.
 *
 * Distinct from `ConfidenceResult` because that one describes a *gate outcome*
 * and is reused on `QueryResult`, where the per-chunk working is deliberately not
 * carried out to the caller. The gate result always has the array; the query
 * result may not. Declaring one type with an optional `scored` forced a null check
 * at each of the eight places `answer.ts` uses it, which is a worse outcome than
 * the cast it replaced — so the two shapes are named separately instead.
 *
 * This was missing from the declared shape entirely, which is why `answer.ts`
 * destructured it untyped in the first place.
 */
export interface ScoredResult extends ConfidenceResult {
  scored: ScoredChunk[];
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
  index: number;
  externalId: string | null;
}

/**
 * A retrieved chunk as it moves between the pipeline stages.
 *
 * This was declared twice — once in `confidence.ts` and once in
 * `providers/rerank.ts` — with different field lists, and neither exported it.
 * Because a `ScoredChunk` from `scoreChunks` was therefore not assignable to the
 * `ChunkWithScore` that `rerank` accepted, every handoff in `answer.ts` and
 * `retrieve.ts` needed `as any`. Those casts were papering over a duplicated
 * type rather than over anything genuinely dynamic, so the type lives here once,
 * next to `ChunkResult` (the public projection of the same object).
 *
 * The index signature is deliberate: a chunk carries its source document's
 * metadata verbatim — `section_path`, `department`, `source_file`, and whatever
 * else a given corpus puts there — so arbitrary keys are part of the contract.
 * What is named is the part the pipeline itself reads.
 */
export interface ScoredChunk {
  chunkId?: string;
  content: string;
  documentId: string;
  /** Set by hybrid retrieval. */
  fusedScore?: number;
  /** Set by `rerank`. Callers prefer this and fall back to `fusedScore`. */
  rerankScore?: number;
  /** Legacy retrieval score. */
  score?: number;
  metadata?: Record<string, unknown>;
  /** Set by `expandWithParent` when the parent section was also read. */
  parentContext?: string;
  /** Set by `scoreChunks`. */
  confidence?: number;
  components?: ScoreComponents;
  [key: string]: unknown;
}

export interface ScoreComponents {
  retrievalScore: number;
  freshness: number;
  authority: number;
  agreement: number;
}

/**
 * A document row as loaded by `loadDocumentTitles`.
 *
 * Every field is nullable because that is what the row actually contains — these
 * come straight from Postgres, not from a validated input. This shape was
 * previously declared twice: here with `authority?: number`, and in
 * `retrieve.ts` with `authority: number | null` plus the fields only retrieval
 * reads. The narrower copy is what made `applyAuthorityWeighting` need a cast at
 * its single call site, and what forced `scoreChunks` to accept a different type
 * than the metadata it was actually being handed.
 *
 * One declaration with the real nullability, so `doc.authority != null` narrows
 * the way it reads and nothing has to bridge the two views.
 */
export interface DocMeta {
  title: string | null;
  source_file: string | null;
  version: number;
  department: string | null;
  doc_type: string | null;
  confidential: boolean;
  allowed_roles: string[];
  status: string | null;
  created_at: Date | string | null;
  authority: number | null;
}