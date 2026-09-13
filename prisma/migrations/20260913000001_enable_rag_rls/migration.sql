-- Enable RLS on RAG tables — Supabase best practices
-- Impact CRITICAL: tenant isolation at DB level (security-rls-basics.md)
-- Performance: wrap auth calls in SELECT (security-rls-performance.md)
-- Idempotent, pooler-safe, handles local postgres without supabase auth schema

CREATE SCHEMA IF NOT EXISTS private;

-- Helper: tenant check with cached auth call — avoids per-row auth.jwt() cost
-- Try auth-aware version first (Supabase), fallback to app setting only (local dev)
DO $$
BEGIN
  CREATE OR REPLACE FUNCTION private.current_tenant_id() RETURNS TEXT
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
  AS $f$
    SELECT COALESCE(
      (SELECT (auth.jwt() ->> 'tenant_id')),
      (SELECT (auth.jwt() ->> 'tenantId')),
      (SELECT (auth.jwt() ->> 'workspace_id')),
      current_setting('app.current_tenant_id', true),
      current_setting('app.tenant_id', true),
      current_setting('request.jwt.claim.tenant_id', true)
    )
  $f$;
EXCEPTION WHEN undefined_function OR invalid_schema_name OR undefined_object THEN
  CREATE OR REPLACE FUNCTION private.current_tenant_id() RETURNS TEXT
  LANGUAGE sql STABLE AS $f$ SELECT current_setting('app.current_tenant_id', true) $f$;
END $$;

REVOKE EXECUTE ON FUNCTION private.current_tenant_id() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.current_tenant_id() TO authenticated, service_role;

-- Ensure fallback stays correct if auth schema created later — re-apply auth-aware version when auth exists
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'auth') THEN
    BEGIN
      CREATE OR REPLACE FUNCTION private.current_tenant_id() RETURNS TEXT
      LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
      AS $f$
        SELECT COALESCE(
          (SELECT (auth.jwt() ->> 'tenant_id')),
          (SELECT (auth.jwt() ->> 'tenantId')),
          (SELECT (auth.jwt() ->> 'workspace_id')),
          current_setting('app.current_tenant_id', true),
          current_setting('app.tenant_id', true),
          current_setting('request.jwt.claim.tenant_id', true)
        )
      $f$;
      REVOKE EXECUTE ON FUNCTION private.current_tenant_id() FROM PUBLIC, anon;
      GRANT EXECUTE ON FUNCTION private.current_tenant_id() TO authenticated, service_role;
    EXCEPTION WHEN others THEN NULL;
    END;
  END IF;
END $$;

-- --------------- RagDocument ---------------
ALTER TABLE "RagDocument" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "rag_document_service_role_all" ON "RagDocument";
DROP POLICY IF EXISTS "rag_document_tenant_isolation" ON "RagDocument";
DROP POLICY IF EXISTS "rag_document_anon_no_access" ON "RagDocument";

CREATE POLICY "rag_document_service_role_all" ON "RagDocument"
  FOR ALL TO service_role USING (true) WITH CHECK (true);

DO $$ BEGIN
  BEGIN
    EXECUTE '
      CREATE POLICY "rag_document_tenant_isolation" ON "RagDocument"
        FOR ALL TO authenticated
        USING ((SELECT private.current_tenant_id()) IS NOT NULL AND "tenantId" = (SELECT private.current_tenant_id()))
        WITH CHECK ((SELECT private.current_tenant_id()) IS NOT NULL AND "tenantId" = (SELECT private.current_tenant_id()))
    ';
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
END $$;

CREATE POLICY "rag_document_anon_no_access" ON "RagDocument"
  FOR ALL TO anon USING (false) WITH CHECK (false);

CREATE INDEX IF NOT EXISTS "RagDocument_tenantId_idx" ON "RagDocument"("tenantId");
REVOKE ALL ON "RagDocument" FROM PUBLIC;
GRANT SELECT, INSERT, UPDATE, DELETE ON "RagDocument" TO authenticated, service_role;
GRANT USAGE ON SCHEMA public TO authenticated, service_role, anon;

-- --------------- RagChunk ---------------
ALTER TABLE "RagChunk" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "rag_chunk_service_role_all" ON "RagChunk";
DROP POLICY IF EXISTS "rag_chunk_tenant_isolation" ON "RagChunk";
DROP POLICY IF EXISTS "rag_chunk_anon_no_access" ON "RagChunk";

CREATE POLICY "rag_chunk_service_role_all" ON "RagChunk"
  FOR ALL TO service_role USING (true) WITH CHECK (true);

DO $$ BEGIN
  BEGIN
    EXECUTE '
      CREATE POLICY "rag_chunk_tenant_isolation" ON "RagChunk"
        FOR ALL TO authenticated
        USING ((SELECT private.current_tenant_id()) IS NOT NULL AND "tenantId" = (SELECT private.current_tenant_id()))
        WITH CHECK ((SELECT private.current_tenant_id()) IS NOT NULL AND "tenantId" = (SELECT private.current_tenant_id()))
    ';
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
END $$;

CREATE POLICY "rag_chunk_anon_no_access" ON "RagChunk"
  FOR ALL TO anon USING (false) WITH CHECK (false);

CREATE INDEX IF NOT EXISTS "RagChunk_tenantId_idx" ON "RagChunk"("tenantId");
REVOKE ALL ON "RagChunk" FROM PUBLIC;
GRANT SELECT, INSERT, UPDATE, DELETE ON "RagChunk" TO authenticated, service_role;

-- --------------- RagFeedback ---------------
ALTER TABLE "RagFeedback" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "rag_feedback_service_role_all" ON "RagFeedback";
DROP POLICY IF EXISTS "rag_feedback_tenant_isolation" ON "RagFeedback";
DROP POLICY IF EXISTS "rag_feedback_anon_no_access" ON "RagFeedback";

CREATE POLICY "rag_feedback_service_role_all" ON "RagFeedback"
  FOR ALL TO service_role USING (true) WITH CHECK (true);

DO $$ BEGIN
  BEGIN
    EXECUTE '
      CREATE POLICY "rag_feedback_tenant_isolation" ON "RagFeedback"
        FOR ALL TO authenticated
        USING ((SELECT private.current_tenant_id()) IS NOT NULL AND "tenantId" = (SELECT private.current_tenant_id()))
        WITH CHECK ((SELECT private.current_tenant_id()) IS NOT NULL AND "tenantId" = (SELECT private.current_tenant_id()))
    ';
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
END $$;

CREATE POLICY "rag_feedback_anon_no_access" ON "RagFeedback"
  FOR ALL TO anon USING (false) WITH CHECK (false);

REVOKE ALL ON "RagFeedback" FROM PUBLIC;
GRANT SELECT, INSERT, UPDATE, DELETE ON "RagFeedback" TO authenticated, service_role;

-- --------------- RagQueryLog ---------------
ALTER TABLE "RagQueryLog" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "rag_query_log_service_role_all" ON "RagQueryLog";
DROP POLICY IF EXISTS "rag_query_log_tenant_isolation" ON "RagQueryLog";
DROP POLICY IF EXISTS "rag_query_log_anon_no_access" ON "RagQueryLog";

CREATE POLICY "rag_query_log_service_role_all" ON "RagQueryLog"
  FOR ALL TO service_role USING (true) WITH CHECK (true);

DO $$ BEGIN
  BEGIN
    EXECUTE '
      CREATE POLICY "rag_query_log_tenant_isolation" ON "RagQueryLog"
        FOR ALL TO authenticated
        USING ((SELECT private.current_tenant_id()) IS NOT NULL AND "tenantId" = (SELECT private.current_tenant_id()))
        WITH CHECK ((SELECT private.current_tenant_id()) IS NOT NULL AND "tenantId" = (SELECT private.current_tenant_id()))
    ';
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
END $$;

CREATE POLICY "rag_query_log_anon_no_access" ON "RagQueryLog"
  FOR ALL TO anon USING (false) WITH CHECK (false);

REVOKE ALL ON "RagQueryLog" FROM PUBLIC;
GRANT SELECT, INSERT, UPDATE, DELETE ON "RagQueryLog" TO authenticated, service_role;

-- Verify:
-- SET LOCAL app.current_tenant_id = 'ws_test'; SELECT * FROM "RagDocument";
-- SELECT * FROM pg_policies WHERE tablename LIKE 'Rag%';
-- SELECT private.current_tenant_id();
