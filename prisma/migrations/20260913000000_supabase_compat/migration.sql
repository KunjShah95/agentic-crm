-- Supabase compatibility & RAG module (schema.prisma Rag* models)
-- Makes all prior migrations pooler-safe + adds missing Supabase extensions/indexes
-- Idempotent: safe to run via `prisma migrate deploy` on Supabase direct or pooled URL

-- 1) Extensions (Supabase already has pgcrypto; pgvector needed for RagChunk.embedding)
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "vector";
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements";

-- 2) Repair Association migration where legacy file had escaped quotes / missing FK indexes
--    (IF NOT EXISTS makes this safe if 20260903000000_association already applied on fixed file)
CREATE INDEX IF NOT EXISTS "AssociationLead_contactId_idx" ON "AssociationLead"("contactId");
CREATE INDEX IF NOT EXISTS "AssociationLead_pooledByWorkspaceId_idx" ON "AssociationLead"("pooledByWorkspaceId");
CREATE INDEX IF NOT EXISTS "AssociationLead_claimedByWorkspaceId_idx" ON "AssociationLead"("claimedByWorkspaceId");
CREATE INDEX IF NOT EXISTS "AssociationListing_unitId_idx" ON "AssociationListing"("unitId");
CREATE INDEX IF NOT EXISTS "AssociationListing_listedByWorkspaceId_idx" ON "AssociationListing"("listedByWorkspaceId");
CREATE INDEX IF NOT EXISTS "Referral_associationId_idx" ON "Referral"("associationId");
CREATE INDEX IF NOT EXISTS "Referral_fromWorkspaceId_idx" ON "Referral"("fromWorkspaceId");
CREATE INDEX IF NOT EXISTS "Referral_toWorkspaceId_idx" ON "Referral"("toWorkspaceId");
CREATE INDEX IF NOT EXISTS "Referral_contactId_idx" ON "Referral"("contactId");
CREATE INDEX IF NOT EXISTS "Referral_dealId_idx" ON "Referral"("dealId");
CREATE INDEX IF NOT EXISTS "BuyerPortalAccess_contactId_idx" ON "BuyerPortalAccess"("contactId");
CREATE INDEX IF NOT EXISTS "BuyerPortalAccess_token_idx" ON "BuyerPortalAccess"("token");
CREATE INDEX IF NOT EXISTS "BuyerPortalAccess_expiresAt_idx" ON "BuyerPortalAccess"("expiresAt");

-- 3) Enums for RAG (idempotent)
DO $$ BEGIN
  CREATE TYPE "RagModality" AS ENUM ('TEXT', 'IMAGE', 'AUDIO', 'VIDEO');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "RagDocumentStatus" AS ENUM ('PROCESSING', 'READY', 'ERROR');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 4) RagDocument
CREATE TABLE IF NOT EXISTS "RagDocument" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "sourceFile" TEXT NOT NULL,
  "title" TEXT,
  "status" "RagDocumentStatus" NOT NULL DEFAULT 'PROCESSING',
  "contentHash" TEXT NOT NULL,
  "externalId" TEXT,
  "modality" "RagModality" NOT NULL DEFAULT 'TEXT',
  "lang" TEXT DEFAULT 'en',
  "version" INTEGER NOT NULL DEFAULT 1,
  "chunkCount" INTEGER NOT NULL DEFAULT 0,
  "error" TEXT,
  "department" TEXT NOT NULL DEFAULT 'general',
  "docType" TEXT,
  "tags" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "authority" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
  "confidential" BOOLEAN NOT NULL DEFAULT false,
  "allowedRoles" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "syncSource" TEXT,
  "syncCursor" TEXT,
  "createdBy" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "rag_document_content_hash_unique" UNIQUE ("contentHash")
);
CREATE INDEX IF NOT EXISTS "RagDocument_tenantId_idx" ON "RagDocument"("tenantId");
CREATE INDEX IF NOT EXISTS "RagDocument_tenantId_status_idx" ON "RagDocument"("tenantId", "status");
CREATE INDEX IF NOT EXISTS "RagDocument_tenantId_externalId_idx" ON "RagDocument"("tenantId", "externalId");
CREATE INDEX IF NOT EXISTS "RagDocument_tenantId_department_idx" ON "RagDocument"("tenantId", "department");
CREATE INDEX IF NOT EXISTS "RagDocument_tenantId_contentHash_idx" ON "RagDocument"("tenantId", "contentHash");

-- 5) RagChunk (vector(1024) requires pgvector; fallback to TEXT if extension missing — try vector first)
DO $$ BEGIN
  CREATE TABLE IF NOT EXISTS "RagChunk" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "chunkIndex" INTEGER NOT NULL,
    "chunkHash" TEXT,
    "content" TEXT NOT NULL,
    "modality" "RagModality" NOT NULL DEFAULT 'TEXT',
    "lang" TEXT NOT NULL DEFAULT 'en',
    "embedding" vector(1024),
    "model" TEXT,
    "dim" INTEGER,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RagChunk_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "RagDocument"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "RagChunk_tenantId_documentId_chunkIndex_key" UNIQUE ("tenantId", "documentId", "chunkIndex")
  );
EXCEPTION WHEN undefined_object THEN
  -- pgvector not available on this branch/local — create without vector type so migration still passes
  CREATE TABLE IF NOT EXISTS "RagChunk" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "chunkIndex" INTEGER NOT NULL,
    "chunkHash" TEXT,
    "content" TEXT NOT NULL,
    "modality" "RagModality" NOT NULL DEFAULT 'TEXT',
    "lang" TEXT NOT NULL DEFAULT 'en',
    "embedding" TEXT,
    "model" TEXT,
    "dim" INTEGER,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RagChunk_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "RagDocument"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "RagChunk_tenantId_documentId_chunkIndex_key" UNIQUE ("tenantId", "documentId", "chunkIndex")
  );
END $$;

CREATE INDEX IF NOT EXISTS "RagChunk_tenantId_documentId_idx" ON "RagChunk"("tenantId", "documentId");
CREATE INDEX IF NOT EXISTS "RagChunk_tenantId_idx" ON "RagChunk"("tenantId");
-- HNSW index for pgvector cosine search (only if vector column exists)
DO $$ BEGIN
  CREATE INDEX "RagChunk_embedding_idx" ON "RagChunk" USING hnsw ("embedding" vector_cosine_ops);
EXCEPTION WHEN undefined_column OR undefined_object THEN NULL;
END $$;

-- 6) RagFeedback
CREATE TABLE IF NOT EXISTS "RagFeedback" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "query" TEXT NOT NULL,
  "answer" TEXT,
  "rating" INTEGER NOT NULL,
  "correction" TEXT,
  "documentId" TEXT,
  "createdBy" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "RagFeedback_tenantId_idx" ON "RagFeedback"("tenantId");
CREATE INDEX IF NOT EXISTS "RagFeedback_tenantId_createdAt_idx" ON "RagFeedback"("tenantId", "createdAt");

-- 7) RagQueryLog
CREATE TABLE IF NOT EXISTS "RagQueryLog" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "query" TEXT NOT NULL,
  "departments" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "scope" TEXT,
  "topK" INTEGER,
  "confidence" DOUBLE PRECISION,
  "faithfulness" DOUBLE PRECISION,
  "refused" BOOLEAN NOT NULL DEFAULT false,
  "attempts" INTEGER NOT NULL DEFAULT 1,
  "latencyMs" INTEGER NOT NULL,
  "provider" TEXT,
  "createdBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "RagQueryLog_tenantId_idx" ON "RagQueryLog"("tenantId");
CREATE INDEX IF NOT EXISTS "RagQueryLog_tenantId_createdAt_idx" ON "RagQueryLog"("tenantId", "createdAt");

-- 8) Supabase best-practice: constraint naming is already idempotent; no RLS forced here.
--    Tables use service_role via NextAuth/Prisma driver; enable RLS later with:
--    ALTER TABLE "RagDocument" ENABLE ROW LEVEL SECURITY;
--    CREATE POLICY ... FOR ALL TO authenticated USING (tenantId = auth.jwt() ->> 'tenantId');
--    Left disabled by default to keep Prisma service_role access working on Supabase pooler (transaction mode).
--    Connection pooling note: runtime DATABASE_URL should be pooler with ?pgbouncer=true&connection_limit=1,
--    migrations must run on direct URL (db.*.supabase.co:5432). See prisma.config.ts.

-- 9) UpdatedAt trigger helper (Prisma @updatedAt is app-level; add DB fallback for raw SQL writes on Supabase)
CREATE OR REPLACE FUNCTION set_updated_at() RETURNS TRIGGER AS $$
BEGIN NEW."updatedAt" = NOW(); RETURN NEW; END; $$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS rag_document_updated_at ON "RagDocument";
CREATE TRIGGER rag_document_updated_at BEFORE UPDATE ON "RagDocument" FOR EACH ROW EXECUTE FUNCTION set_updated_at();
DROP TRIGGER IF EXISTS rag_chunk_updated_at ON "RagChunk";
CREATE TRIGGER rag_chunk_updated_at BEFORE UPDATE ON "RagChunk" FOR EACH ROW EXECUTE FUNCTION set_updated_at();
