-- Supabase-compatible enum extension: IF NOT EXISTS makes re-deploy idempotent on pooled connections
-- Supabase PG 17 supports ADD VALUE IF NOT EXISTS (PG 14+). Each in its own statement, transaction-safe.

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'SALES' AND enumtypid = '"Role"'::regtype) THEN
    ALTER TYPE "Role" ADD VALUE 'SALES';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'CP' AND enumtypid = '"Role"'::regtype) THEN
    ALTER TYPE "Role" ADD VALUE 'CP';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'VIEWER' AND enumtypid = '"Role"'::regtype) THEN
    ALTER TYPE "Role" ADD VALUE 'VIEWER';
  END IF;
END $$;

-- Fallback for clean DBs where the above DO blocks never ran (still idempotent):
-- ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'SALES';
-- ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'CP';
-- ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'VIEWER';

-- AlterTable
ALTER TABLE "Deal" ADD COLUMN IF NOT EXISTS "cpId" TEXT;

-- AlterTable
ALTER TABLE "PaymentMilestone" ADD COLUMN IF NOT EXISTS "daysAfter" INTEGER;
ALTER TABLE "PaymentMilestone" ADD COLUMN IF NOT EXISTS "dueTrigger" TEXT;

-- CreateTable
CREATE TABLE IF NOT EXISTS "SiteVisit" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "unitId" TEXT,
    "dealId" TEXT,
    "scheduledAt" TIMESTAMP(3) NOT NULL,
    "checkedInAt" TIMESTAMP(3),
    "gps" JSONB,
    "notes" TEXT,
    "outcome" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SiteVisit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "ChannelPartner" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "reraNo" TEXT,
    "brokerage" DOUBLE PRECISION,
    "userId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChannelPartner_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "CommissionRule" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "dealId" TEXT NOT NULL,
    "cpId" TEXT NOT NULL,
    "pct" DOUBLE PRECISION,
    "amount" DOUBLE PRECISION,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CommissionRule_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "SiteVisit_workspaceId_idx" ON "SiteVisit"("workspaceId");
CREATE INDEX IF NOT EXISTS "SiteVisit_leadId_idx" ON "SiteVisit"("leadId");
CREATE INDEX IF NOT EXISTS "SiteVisit_dealId_idx" ON "SiteVisit"("dealId");
CREATE INDEX IF NOT EXISTS "SiteVisit_scheduledAt_idx" ON "SiteVisit"("scheduledAt");

CREATE INDEX IF NOT EXISTS "ChannelPartner_workspaceId_idx" ON "ChannelPartner"("workspaceId");
CREATE INDEX IF NOT EXISTS "ChannelPartner_userId_idx" ON "ChannelPartner"("userId");

CREATE INDEX IF NOT EXISTS "CommissionRule_workspaceId_idx" ON "CommissionRule"("workspaceId");
CREATE INDEX IF NOT EXISTS "CommissionRule_dealId_idx" ON "CommissionRule"("dealId");
CREATE INDEX IF NOT EXISTS "CommissionRule_cpId_idx" ON "CommissionRule"("cpId");
CREATE INDEX IF NOT EXISTS "Deal_cpId_idx" ON "Deal"("cpId");

-- AddForeignKey - idempotent via DO blocks (Supabase lacks ADD CONSTRAINT IF NOT EXISTS)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Deal_cpId_fkey') THEN
    ALTER TABLE "Deal" ADD CONSTRAINT "Deal_cpId_fkey" FOREIGN KEY ("cpId") REFERENCES "ChannelPartner"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'SiteVisit_workspaceId_fkey') THEN
    ALTER TABLE "SiteVisit" ADD CONSTRAINT "SiteVisit_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'SiteVisit_leadId_fkey') THEN
    ALTER TABLE "SiteVisit" ADD CONSTRAINT "SiteVisit_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Contact"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'SiteVisit_dealId_fkey') THEN
    ALTER TABLE "SiteVisit" ADD CONSTRAINT "SiteVisit_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "Deal"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ChannelPartner_workspaceId_fkey') THEN
    ALTER TABLE "ChannelPartner" ADD CONSTRAINT "ChannelPartner_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ChannelPartner_userId_fkey') THEN
    ALTER TABLE "ChannelPartner" ADD CONSTRAINT "ChannelPartner_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'CommissionRule_workspaceId_fkey') THEN
    ALTER TABLE "CommissionRule" ADD CONSTRAINT "CommissionRule_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'CommissionRule_dealId_fkey') THEN
    ALTER TABLE "CommissionRule" ADD CONSTRAINT "CommissionRule_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "Deal"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'CommissionRule_cpId_fkey') THEN
    ALTER TABLE "CommissionRule" ADD CONSTRAINT "CommissionRule_cpId_fkey" FOREIGN KEY ("cpId") REFERENCES "ChannelPartner"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
