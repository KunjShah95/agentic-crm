-- ============================================================
-- Supabase All-in-One: Migrations + Seed for kkshah2005@gmail.com
-- Project: oyrrfqddasarqulgvpcd
-- FIXED: '"Role"'::regtype + FK-safe seed (lookup user id, not hard-coded)
-- Run via Supabase SQL Editor OR psql:
--   psql "postgresql://postgres:***@db.oyrrfqddasarqulgvpcd.supabase.co:5432/postgres" -f supabase/all-in-one-migrate-and-seed.sql
-- This file is idempotent — safe to re-run
-- NOTE: This is the QUICK-FIX version covering critical migration + seed.
-- For full history, run: npx prisma migrate deploy
-- ============================================================
\set ON_ERROR_STOP on
BEGIN;
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "vector";
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements";
CREATE SCHEMA IF NOT EXISTS "public";
DO $$ BEGIN CREATE TYPE "Role" AS ENUM ('OWNER', 'ADMIN', 'MEMBER'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "ActivityType" AS ENUM ('NOTE', 'EMAIL', 'CALL', 'MEETING', 'TASK'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
CREATE TABLE IF NOT EXISTS "Workspace" ("id" TEXT NOT NULL PRIMARY KEY, "name" TEXT NOT NULL, "slug" TEXT NOT NULL, "plan" TEXT NOT NULL DEFAULT 'free', "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS "User" ("id" TEXT NOT NULL PRIMARY KEY, "email" TEXT NOT NULL, "name" TEXT NOT NULL, "passwordHash" TEXT, "avatarUrl" TEXT, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS "WorkspaceMember" ("workspaceId" TEXT NOT NULL, "userId" TEXT NOT NULL, "role" "Role" NOT NULL DEFAULT 'MEMBER', "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "WorkspaceMember_pkey" PRIMARY KEY ("workspaceId","userId"));
CREATE TABLE IF NOT EXISTS "Contact" ("id" TEXT NOT NULL PRIMARY KEY, "workspaceId" TEXT NOT NULL, "firstName" TEXT NOT NULL, "lastName" TEXT NOT NULL, "email" TEXT, "phone" TEXT, "linkedinUrl" TEXT, "jobTitle" TEXT, "organizationId" TEXT, "ownerId" TEXT, "createdBy" TEXT NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL);
-- Add minimal constraints needed for seed FKs (others already in DB if you ran prior migrations)
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='WorkspaceMember_userId_fkey') THEN ALTER TABLE "WorkspaceMember" ADD CONSTRAINT "WorkspaceMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE; END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='WorkspaceMember_workspaceId_fkey') THEN ALTER TABLE "WorkspaceMember" ADD CONSTRAINT "WorkspaceMember_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE; END IF; END $$;
-- FIXED enum quoting
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel='SALES' AND enumtypid='"Role"'::regtype) THEN ALTER TYPE "Role" ADD VALUE 'SALES'; END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel='CP' AND enumtypid='"Role"'::regtype) THEN ALTER TYPE "Role" ADD VALUE 'CP'; END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel='VIEWER' AND enumtypid='"Role"'::regtype) THEN ALTER TYPE "Role" ADD VALUE 'VIEWER'; END IF; END $$;
-- SEED for kunjshah — FK-safe: lookup real ids, don't hard-code user_kkshah_001
-- 1) User (idempotent on email)
INSERT INTO "User" ("id","email","name","passwordHash","createdAt")
VALUES ('user_kkshah_001','kkshah2005@gmail.com','KK Shah', crypt('password123', gen_salt('bf',12)), NOW())
ON CONFLICT ("email") DO UPDATE SET "name"=EXCLUDED."name";
-- 2) Workspace (idempotent on slug)
INSERT INTO "Workspace" ("id","name","slug","plan","createdAt","settingsJson")
VALUES ('ws_kunjshah_001','KK Shah Realty','kunjshah','pro',NOW(),'{"city":"Ahmedabad"}'::jsonb)
ON CONFLICT ("id") DO NOTHING;
-- If workspace already existed with different id but same slug, use the existing slug's id for member
-- Ensure ws_kunjshah_001 exists even when slug taken by other id: update slug's row to ensure name
INSERT INTO "Workspace" ("id","name","slug","plan","createdAt")
SELECT 'ws_kunjshah_001','KK Shah Realty','kunjshah','pro',NOW()
WHERE NOT EXISTS (SELECT 1 FROM "Workspace" WHERE slug='kunjshah')
ON CONFLICT DO NOTHING;
-- 3) WorkspaceMember — FK-safe: use actual user id + actual workspace id (handles existing cuid ids)
INSERT INTO "WorkspaceMember" ("workspaceId","userId","role","createdAt")
SELECT w.id, u.id, 'OWNER', NOW()
FROM "User" u, "Workspace" w
WHERE u.email='kkshah2005@gmail.com' AND w.slug='kunjshah'
ON CONFLICT ("workspaceId","userId") DO NOTHING;
COMMIT;
-- Verify:
-- select u.id, u.email, w.slug, wm.role from "User" u join "WorkspaceMember" wm on wm."userId"=u.id join "Workspace" w on w.id=wm."workspaceId" where u.email='kkshah2005@gmail.com';
