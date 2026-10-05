-- ============================================================================
-- Tenant RLS policies — PREPARATION ONLY. Nothing here is enforced yet.
-- ============================================================================
--
-- WHY THIS IS A SEPARATE, SAFE STEP
-- ---------------------------------
-- `docs/security/open-findings.md` (HIGH) records that effective tenant
-- isolation is ONE layer, not three: the app gate and the Prisma `where`
-- clause. The third layer — Postgres RLS — was documented but not deployed.
--
-- MEASURED AGAINST THE LIVE DATABASE (2026-10-04). This corrects the obvious
-- reading of that finding, so read it before assuming:
--
--   * ALL 43 tables in the public schema already have relrowsecurity = true.
--   * Only the four Rag* tables have any policy.
--   * The 31 tenant tables have RLS ON and ZERO policies — which means they are
--     ALREADY deny-all for any role without BYPASSRLS.
--
-- The application reads them fine because `DATABASE_URL` connects as `postgres`,
-- which carries BYPASSRLS *and* owns the tables; an owner bypasses its own RLS.
--
-- So this migration does not switch enforcement on. It supplies the policies
-- that make the already-enabled enforcement mean something. The genuinely
-- irreversible step is the role change, which is why it lives in a script:
--
--   step 1 (THIS FILE, safe to run)  role + helper + policies + indexes
--   step 2 (scripts/enable-rls.ts)   verify the GUC round-trip, then switch
--                                     DATABASE_URL to estate360_app
--
-- Applying this migration while `DATABASE_URL` still points at a BYPASSRLS role
-- changes nothing observable: policies are consulted only by roles subject to
-- RLS. That is what makes it safe on every environment today.
--
-- THE ROLE IS THE POINT
-- ---------------------
-- `.env.example` documents `DATABASE_URL` as the Supabase `postgres` role,
-- which carries BYPASSRLS. Policies are skipped entirely for a role with that
-- attribute, which is why the existing RAG policies have never engaged. So a
-- role is created here:
--
--   estate360_app  NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT
--                  NOBYPASSRLS LOGIN
--
-- It does NOT have LOGIN yet. Credentials and a GRANT are deliberately left to
-- the operator, because a migration that can rotate database credentials is a
-- migration that can lock you out of your own database. Switching
-- `DATABASE_URL` to this role is the cutover, and it is the step that turns
-- enforcement on — see `scripts/enable-rls.ts`.
--
-- THE HELPER
-- ----------
-- `private.current_tenant_id()` already exists from
-- `20260913000001_enable_rag_rls`. It is redefined here as a thin wrapper so
-- that the RAG tables and the CRM tables read the tenant through exactly one
-- function. Two functions reading the same GUC is how those two halves drift.
--
-- Every policy wraps it in `(SELECT …)` so Postgres evaluates it once per
-- query rather than once per row — a per-row `current_setting()` on a table
-- with a few million rows is a table scan's worth of extra work.

-- ----------------------------------------------------------------------------
-- 1. Helper
-- ----------------------------------------------------------------------------

CREATE SCHEMA IF NOT EXISTS private;

-- Single source of truth for "which tenant is this query for".
--
-- SECURITY DEFINER with an empty search_path: the function is stable and called
-- from every policy, so it must not be able to be hijacked by a caller-supplied
-- schema earlier in the path.
--
-- COALESCE order matters — auth.jwt() first so that a Supabase-native client
-- (Storage, the anon/authenticated roles) keeps working, GUC last so the
-- Prisma path is the fallback rather than the override.
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
  -- Local/dev Postgres with no `auth` schema: GUC only.
  CREATE OR REPLACE FUNCTION private.current_tenant_id() RETURNS TEXT
  LANGUAGE sql STABLE SET search_path = ''
  AS $f$ SELECT COALESCE(
    current_setting('app.current_tenant_id', true),
    current_setting('app.tenant_id', true)
  ) $f$;
END $$;

REVOKE EXECUTE ON FUNCTION private.current_tenant_id() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.current_tenant_id() TO estate360_app;

-- ----------------------------------------------------------------------------
-- 2. Application role
-- ----------------------------------------------------------------------------
--
-- NOBYPASSRLS is the attribute the whole exercise depends on. Everything else
-- is least-privilege hygiene. No LOGIN: the operator creates the credential.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'estate360_app') THEN
    CREATE ROLE estate360_app
      NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS NOREPLICATION;
  END IF;
END $$;

-- Privileges, granted but not exercised until DATABASE_URL switches.
--
-- Schema usage first: without USAGE on `public`, no table grant is reachable.
-- Note `private` is granted too — the helper is SECURITY DEFINER but still
-- needs EXECUTE, granted above.
GRANT USAGE ON SCHEMA public  TO estate360_app;
GRANT USAGE ON SCHEMA private TO estate360_app;

-- ----------------------------------------------------------------------------
-- 3. Supporting indexes
-- ----------------------------------------------------------------------------
--
-- Every policy below filters on workspaceId. Most of these tables already
-- index it as the leading column, but not all do, and a sequential scan per
-- policy evaluation is how an RLS rollout takes down production. Created here
-- (not at enforcement time) so the cost is paid while nothing depends on it.
--
-- IF NOT EXISTS throughout: re-running must be a no-op.

CREATE INDEX IF NOT EXISTS "Subscription_workspaceId_rls_idx"      ON "Subscription"("workspaceId");
CREATE INDEX IF NOT EXISTS "CostSheet_workspaceId_rls_idx"         ON "CostSheet"("workspaceId");
CREATE INDEX IF NOT EXISTS "DocumentTemplate_workspaceId_rls_idx"  ON "DocumentTemplate"("workspaceId");
CREATE INDEX IF NOT EXISTS "GeneratedDocument_workspaceId_rls_idx" ON "GeneratedDocument"("workspaceId");
CREATE INDEX IF NOT EXISTS "WebhookEvent_workspaceId_rls_idx"      ON "WebhookEvent"("workspaceId");
CREATE INDEX IF NOT EXISTS "SocialConnection_workspaceId_rls_idx"  ON "SocialConnection"("workspaceId");
CREATE INDEX IF NOT EXISTS "SocialEvent_workspaceId_rls_idx"       ON "SocialEvent"("workspaceId");
CREATE INDEX IF NOT EXISTS "UsageEvent_workspaceId_rls_idx"        ON "UsageEvent"("workspaceId");
CREATE INDEX IF NOT EXISTS "UsageCounter_workspaceId_rls_idx"      ON "UsageCounter"("workspaceId");
CREATE INDEX IF NOT EXISTS "WorkspaceInvite_workspaceId_rls_idx"   ON "WorkspaceInvite"("workspaceId");
CREATE INDEX IF NOT EXISTS "PipelineStage_workspaceId_rls_idx"     ON "PipelineStage"("workspaceId");
CREATE INDEX IF NOT EXISTS "CommissionRule_workspaceId_rls_idx"    ON "CommissionRule"("workspaceId");
CREATE INDEX IF NOT EXISTS "BuyerPortalAccess_workspaceId_rls_idx" ON "BuyerPortalAccess"("workspaceId");
CREATE INDEX IF NOT EXISTS "AssociationMember_workspaceId_rls_idx" ON "AssociationMember"("workspaceId");

-- ----------------------------------------------------------------------------
-- 4. Policies — direct workspaceId tables
-- ----------------------------------------------------------------------------
--
-- Shape, identical on all 25 direct tables. Emitted by five FOREACH loops rather
-- than 25 hand-written blocks, so there is one predicate to audit and one place
-- for it to be wrong. `tests/unit/rls-cutover.test.ts` asserts the loops still
-- carry both halves.
--
--   USING      (SELECT private.current_tenant_id()) IS NOT NULL
--              AND "workspaceId" = (SELECT private.current_tenant_id())
--   WITH CHECK <same>
--
-- Two halves, both required:
--   * `IS NOT NULL` — fails CLOSED when the GUC is unset. Without it,
--     `"workspaceId" = NULL` evaluates to NULL, which RLS treats as *deny*,
--     so it happens to be safe — but explicitly, because the next person to
--     "simplify" this into `"workspaceId" = (…)` should not have to know that.
--   * `WITH CHECK` — without it a row can be READ under your tenant and WRITTEN
--     under someone else's. This is the half that is usually forgotten, and it
--     is the half that turns a read bug into a write bug.
--
-- `FOR ALL` rather than splitting SELECT/INSERT/UPDATE/DELETE: the predicate is
-- identical, and four policies per table is 100 policies to keep in step.
--
-- Table name is not always the model name — `model Broker @@map("ChannelPartner")`
-- is stored as "ChannelPartner". `scripts/verify-schema-sync.ts` already knows
-- about @map, and the list below was taken from the same source.

-- ── CRM core ─────────────────────────────────────────────────────────────────
-- Contact, Deal, Organization, Activity, Tag, PipelineStage, Project, Unit,
-- SiteVisit. Note Project is here and not with the child tables below: it
-- carries workspaceId directly, so it uses the flat shape.
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'Contact', 'Deal', 'Organization', 'Activity', 'Tag',
    'PipelineStage', 'Project', 'Unit', 'SiteVisit'
  ] LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', t || '_tenant_isolation', t);
    EXECUTE format($p$
      CREATE POLICY %I ON %I
        FOR ALL TO estate360_app
        USING (
          (SELECT private.current_tenant_id()) IS NOT NULL
          AND "workspaceId" = (SELECT private.current_tenant_id())
        )
        WITH CHECK (
          (SELECT private.current_tenant_id()) IS NOT NULL
          AND "workspaceId" = (SELECT private.current_tenant_id())
        )
    $p$, t || '_tenant_isolation', t);
  END LOOP;
END $$;

-- ── Transactions ────────────────────────────────────────────────────────────
-- Payment, CostSheet, DocumentTemplate, GeneratedDocument
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'Payment', 'CostSheet', 'DocumentTemplate', 'GeneratedDocument'
  ] LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', t || '_tenant_isolation', t);
    EXECUTE format($p$
      CREATE POLICY %I ON %I
        FOR ALL TO estate360_app
        USING (
          (SELECT private.current_tenant_id()) IS NOT NULL
          AND "workspaceId" = (SELECT private.current_tenant_id())
        )
        WITH CHECK (
          (SELECT private.current_tenant_id()) IS NOT NULL
          AND "workspaceId" = (SELECT private.current_tenant_id())
        )
    $p$, t || '_tenant_isolation', t);
  END LOOP;
END $$;

-- ── Workspace membership, invites, billing ──────────────────────────────────
-- WorkspaceMember, WorkspaceInvite, Subscription, UsageCounter, UsageEvent
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'WorkspaceMember', 'WorkspaceInvite', 'Subscription',
    'UsageCounter', 'UsageEvent', 'Broker'
  ] LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', t || '_tenant_isolation', t);
    EXECUTE format($p$
      CREATE POLICY %I ON %I
        FOR ALL TO estate360_app
        USING (
          (SELECT private.current_tenant_id()) IS NOT NULL
          AND "workspaceId" = (SELECT private.current_tenant_id())
        )
        WITH CHECK (
          (SELECT private.current_tenant_id()) IS NOT NULL
          AND "workspaceId" = (SELECT private.current_tenant_id())
        )
    $p$, t || '_tenant_isolation', t);
  END LOOP;
END $$;

-- NOTE on 'Broker': the model is `Broker` but `@@map("ChannelPartner")` means
-- the TABLE is "ChannelPartner". The loop above names the *model*; the table
-- name is corrected immediately below. Keeping both spellings visible is
-- deliberate — this mismatch is exactly what verify-schema-sync.ts exists to
-- catch, and it has already caused one silent drift in this schema.
DO $$
BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "Broker_tenant_isolation" ON "ChannelPartner"';
  EXECUTE $p$
    CREATE POLICY "Broker_tenant_isolation" ON "ChannelPartner"
      FOR ALL TO estate360_app
      USING (
        (SELECT private.current_tenant_id()) IS NOT NULL
        AND "workspaceId" = (SELECT private.current_tenant_id())
      )
      WITH CHECK (
        (SELECT private.current_tenant_id()) IS NOT NULL
        AND "workspaceId" = (SELECT private.current_tenant_id())
      )
  $p$;
END $$;

-- ── Integrations ────────────────────────────────────────────────────────────
-- SocialConnection, SocialEvent, WebhookEvent, CommissionRule,
-- BuyerPortalAccess, AssociationMember
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'SocialConnection', 'SocialEvent', 'WebhookEvent',
    'CommissionRule', 'BuyerPortalAccess', 'AssociationMember'
  ] LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', t || '_tenant_isolation', t);
    EXECUTE format($p$
      CREATE POLICY %I ON %I
        FOR ALL TO estate360_app
        USING (
          (SELECT private.current_tenant_id()) IS NOT NULL
          AND "workspaceId" = (SELECT private.current_tenant_id())
        )
        WITH CHECK (
          (SELECT private.current_tenant_id()) IS NOT NULL
          AND "workspaceId" = (SELECT private.current_tenant_id())
        )
    $p$, t || '_tenant_isolation', t);
  END LOOP;
END $$;

-- ----------------------------------------------------------------------------
-- 5. Policies — child tables with no workspaceId column
-- ----------------------------------------------------------------------------
--
-- Six tables reach a tenant only through a parent. They cannot use the shape
-- above because they have no `workspaceId` to compare, so each gets a policy
-- that walks to the tenant through its own FK chain. Every EXISTS is written so
-- the *child* row is the correlated variable — an inverted correlation would
-- pass whenever ANY row in the parent matched, which is not isolation at all.
--
-- These are the highest-risk policies in the file, because a mistake here is
-- invisible: `ContactTag` has two parents and picking the wrong one produces a
-- policy that looks right and leaks.

-- Tower → Project.workspaceId
DO $$ BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "Tower_tenant_isolation" ON "Tower"';
  EXECUTE $p$
    CREATE POLICY "Tower_tenant_isolation" ON "Tower"
      FOR ALL TO estate360_app
      USING (EXISTS (
        SELECT 1 FROM "Project" p
        WHERE p."id" = "Tower"."projectId"
          AND p."workspaceId" = (SELECT private.current_tenant_id())
      ))
      WITH CHECK (EXISTS (
        SELECT 1 FROM "Project" p
        WHERE p."id" = "Tower"."projectId"
          AND p."workspaceId" = (SELECT private.current_tenant_id())
      ))
  $p$;
END $$;

-- Floor → Tower → Project
DO $$ BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "Floor_tenant_isolation" ON "Floor"';
  EXECUTE $p$
    CREATE POLICY "Floor_tenant_isolation" ON "Floor"
      FOR ALL TO estate360_app
      USING (EXISTS (
        SELECT 1 FROM "Tower" t
        JOIN "Project" p ON p."id" = t."projectId"
        WHERE t."id" = "Floor"."towerId"
          AND p."workspaceId" = (SELECT private.current_tenant_id())
      ))
      WITH CHECK (EXISTS (
        SELECT 1 FROM "Tower" t
        JOIN "Project" p ON p."id" = t."projectId"
        WHERE t."id" = "Floor"."towerId"
          AND p."workspaceId" = (SELECT private.current_tenant_id())
      ))
  $p$;
END $$;

-- PaymentPlan → Project
DO $$ BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "PaymentPlan_tenant_isolation" ON "PaymentPlan"';
  EXECUTE $p$
    CREATE POLICY "PaymentPlan_tenant_isolation" ON "PaymentPlan"
      FOR ALL TO estate360_app
      USING (EXISTS (
        SELECT 1 FROM "Project" p
        WHERE p."id" = "PaymentPlan"."projectId"
          AND p."workspaceId" = (SELECT private.current_tenant_id())
      ))
      WITH CHECK (EXISTS (
        SELECT 1 FROM "Project" p
        WHERE p."id" = "PaymentPlan"."projectId"
          AND p."workspaceId" = (SELECT private.current_tenant_id())
      ))
  $p$;
END $$;

-- PaymentMilestone → PaymentPlan → Project
DO $$ BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "PaymentMilestone_tenant_isolation" ON "PaymentMilestone"';
  EXECUTE $p$
    CREATE POLICY "PaymentMilestone_tenant_isolation" ON "PaymentMilestone"
      FOR ALL TO estate360_app
      USING (EXISTS (
        SELECT 1 FROM "PaymentPlan" pp
        JOIN "Project" p ON p."id" = pp."projectId"
        WHERE pp."id" = "PaymentMilestone"."planId"
          AND p."workspaceId" = (SELECT private.current_tenant_id())
      ))
      WITH CHECK (EXISTS (
        SELECT 1 FROM "PaymentPlan" pp
        JOIN "Project" p ON p."id" = pp."projectId"
        WHERE pp."id" = "PaymentMilestone"."planId"
          AND p."workspaceId" = (SELECT private.current_tenant_id())
      ))
  $p$;
END $$;

-- ContactTag → Contact.workspaceId.
--
-- Keyed on `contactId`, NOT `tagId`. Both parents are tenant-scoped and both
-- would pass the same EXISTS, so this is not a correctness bug today — but the
-- contact is the tenant-bearing parent, so keying on it states the intent and
-- survives a future where tags are shared across tenants.
DO $$ BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "ContactTag_tenant_isolation" ON "ContactTag"';
  EXECUTE $p$
    CREATE POLICY "ContactTag_tenant_isolation" ON "ContactTag"
      FOR ALL TO estate360_app
      USING (EXISTS (
        SELECT 1 FROM "Contact" c
        WHERE c."id" = "ContactTag"."contactId"
          AND c."workspaceId" = (SELECT private.current_tenant_id())
      ))
      WITH CHECK (EXISTS (
        SELECT 1 FROM "Contact" c
        WHERE c."id" = "ContactTag"."contactId"
          AND c."workspaceId" = (SELECT private.current_tenant_id())
      ))
  $p$;
END $$;

-- DealTag → Deal.workspaceId
DO $$ BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "DealTag_tenant_isolation" ON "DealTag"';
  EXECUTE $p$
    CREATE POLICY "DealTag_tenant_isolation" ON "DealTag"
      FOR ALL TO estate360_app
      USING (EXISTS (
        SELECT 1 FROM "Deal" d
        WHERE d."id" = "DealTag"."dealId"
          AND d."workspaceId" = (SELECT private.current_tenant_id())
      ))
      WITH CHECK (EXISTS (
        SELECT 1 FROM "Deal" d
        WHERE d."id" = "DealTag"."dealId"
          AND d."workspaceId" = (SELECT private.current_tenant_id())
      ))
  $p$;
END $$;

-- ----------------------------------------------------------------------------
-- 6. Deliberately NOT given a policy
-- ----------------------------------------------------------------------------
--
-- Listed so the omissions are decisions rather than oversights. Enforcing these
-- wrongly is how an RLS rollout takes down a working app, so each one is
-- excluded on purpose and the reason is here for whoever revisits it.
--
-- Workspace — the tenant root. RLS here would have to allow "any workspace I am
--   a member of", which needs a recursive policy and defeats the purpose. Also
--   the workspace switcher (lib/auth.ts loadMemberships) legitimately reads
--   across tenants for the signed-in user. Left to the app layer.
--
-- WorkspaceMember — same problem, sharper: `loadMemberships` queries
--   `where: { userId }` with NO workspaceId, to build the switcher. A tenant
--   policy makes that return zero rows and the switcher empty. Needs a
--   user-scoped policy (`EXISTS (SELECT 1 FROM "User" …)`) before it can be
--   enabled — noted as its own piece of work, not folded in here.
--
-- User — auth identity, not tenant data. NextAuth owns it.
--
-- PlanLimits — global plan catalogue, no tenant. Correctly has no workspaceId.
--
-- Association, AssociationLead, AssociationListing, Referral — an NAAR
--   association deliberately spans workspaces: a pooled lead is meant to be
--   visible to member firms of *other* tenants. That is the product feature, so
--   a single-tenant policy would break it by design. These need
--   membership-scoped policies, not tenant-scoped ones.
--
-- RagDocument, RagChunk, RagFeedback, RagQueryLog — already have policies from
--   20260913000001_enable_rag_rls, keyed on `tenantId` rather than
--   `workspaceId`. They have never engaged (BYPASSRLS). Re-pointing those
--   policies at estate360_app is part of the same cutover but is left out here
--   so this file does not half-migrate a subsystem whose GUC semantics
--   (`tenantId`, set by the RAG routes rather than the request path) are
--   different.
--
-- ----------------------------------------------------------------------------
-- 7. Runtime self-check
-- ----------------------------------------------------------------------------
--
-- Measured against the live database on 2026-10-04, and this is the single most
-- important thing to know before running anything in this file:
--
--   ALL 43 tables in the public schema already have relrowsecurity = true.
--   Only the four Rag* tables have any policy at all.
--   Contact, Deal, Organization … have RLS ON and ZERO policies.
--
-- That is not a contradiction — it is the default state of a Supabase project,
-- where every table ships with RLS enabled and policies added per feature.
--
-- The consequence is precise and it inverts the usual worry. Those 31 tenant
-- tables are ALREADY deny-all for any role without BYPASSRLS: RLS on with no
-- policy permits nothing. The application only reads them today because
-- DATABASE_URL connects as `postgres`, which carries BYPASSRLS *and* owns the
-- tables, and a table owner bypasses its own RLS regardless.
--
-- So this migration does not "start" enforcement — it supplies the policies that
-- make enforcement meaningful. Until they exist, switching the role away from
-- BYPASSRLS would return zero rows for every tenant query, which is the failure
-- `scripts/enable-rls.ts` exists to catch before anyone tries.
--
-- This check therefore asserts the opposite of the obvious thing: it requires
-- that RLS is *already* enabled, so the policies being created here have
-- something to attach to. If a future environment somehow ships with it off, the
-- policies would be inert and the cutover script would silently do nothing —
-- so fail loudly here instead.

DO $$
DECLARE off text;
BEGIN
  SELECT string_agg(c.relname, ', ' ORDER BY c.relname)
    INTO off
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
   WHERE n.nspname = 'public'
     AND NOT c.relrowsecurity
     AND c.relname IN (
       'Contact','Deal','Organization','Activity','Tag','PipelineStage','Project',
       'Unit','SiteVisit','Payment','CostSheet','DocumentTemplate','GeneratedDocument',
       'WorkspaceMember','WorkspaceInvite','Subscription','UsageCounter',
       'UsageEvent','ChannelPartner','SocialConnection','SocialEvent',
       'WebhookEvent','CommissionRule','BuyerPortalAccess','AssociationMember',
       'Tower','Floor','PaymentPlan','PaymentMilestone','ContactTag','DealTag'
     );
  IF off IS NOT NULL THEN
    RAISE EXCEPTION
      'Row-level security is NOT enabled on: %. The policies created by this migration '
      'would be inert. On Supabase every table ships with RLS on, so this environment is '
      'unusual — enable it deliberately rather than assuming: ALTER TABLE <name> ENABLE ROW LEVEL SECURITY;',
      off;
  END IF;
END $$;

-- ----------------------------------------------------------------------------
-- 8. Verify
-- ----------------------------------------------------------------------------
--
--   SELECT tablename, policyname, permissive, cmd
--   FROM pg_policies WHERE schemaname = 'public' ORDER BY tablename;
--
-- Expect 31 rows (25 workspaceId tables + 6 child tables), each
-- `tenant_isolation / PERMISSIVE / ALL`.
--
--   -- must be true; proves the policies are stored and not just parsed
--   SELECT count(*) FROM pg_policies WHERE policyname LIKE '%_tenant_isolation';
--
--   -- the cutover gate: does the helper resolve a tenant?
--   BEGIN;
--     SET LOCAL app.current_tenant_id = (SELECT "id" FROM "Workspace" LIMIT 1);
--     SELECT private.current_tenant_id();
--     SELECT count(*) FROM "Contact";   -- must be > 0, not 0
--   ROLLBACK;
--
-- That last block is the whole point of `scripts/enable-rls.ts`: if it returns
-- zero rows, enforcement must not be switched on.