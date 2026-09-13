/*
  Supabase-compatible version: idempotent DROP/CREATE with IF EXISTS / IF NOT EXISTS
  for pooler transaction mode and branch resets
*/
-- CreateEnum (idempotent via DO)
DO $$ BEGIN CREATE TYPE "UnitStatus" AS ENUM ('AVAILABLE', 'HOLD', 'BOOKED', 'SOLD'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "UnitConfig" AS ENUM ('BHK1', 'BHK2', 'BHK3', 'BHK4', 'VILLA', 'PLOT', 'SHOP', 'OFFICE'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "DocumentKind" AS ENUM ('DEMAND_LETTER', 'ALLOTMENT', 'BOOKING_FORM', 'RECEIPT', 'POSSESSION'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Fix: drop searchVector triggers before dropping columns
DROP TRIGGER IF EXISTS contact_search_vector_trigger ON "Contact";
DROP TRIGGER IF EXISTS organization_search_vector_trigger ON "Organization";
DROP TRIGGER IF EXISTS deal_search_vector_trigger ON "Deal";
DROP FUNCTION IF EXISTS contact_search_vector_update() CASCADE;
DROP FUNCTION IF EXISTS organization_search_vector_update() CASCADE;
DROP FUNCTION IF EXISTS deal_search_vector_update() CASCADE;

DROP INDEX IF EXISTS "Contact_searchVector_idx";
DROP INDEX IF EXISTS "Contact_workspace_search_idx";
DROP INDEX IF EXISTS "Deal_searchVector_idx";
DROP INDEX IF EXISTS "Organization_searchVector_idx";

-- AlterTable (Supabase pooler-safe: IF NOT EXISTS)
ALTER TABLE "Activity" ADD COLUMN IF NOT EXISTS "channel" TEXT;
ALTER TABLE "Activity" ADD COLUMN IF NOT EXISTS "direction" TEXT;
ALTER TABLE "Activity" ADD COLUMN IF NOT EXISTS "templateId" TEXT;

ALTER TABLE "Contact" DROP COLUMN IF EXISTS "searchVector";
ALTER TABLE "Contact" ADD COLUMN IF NOT EXISTS "consentAt" TIMESTAMP(3);
ALTER TABLE "Contact" ADD COLUMN IF NOT EXISTS "kycJson" JSONB;
ALTER TABLE "Contact" ADD COLUMN IF NOT EXISTS "leadScore" INTEGER;
ALTER TABLE "Contact" ADD COLUMN IF NOT EXISTS "leadSource" TEXT;
ALTER TABLE "Contact" ADD COLUMN IF NOT EXISTS "optedOut" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Contact" ADD COLUMN IF NOT EXISTS "requirementsJson" JSONB;

ALTER TABLE "Deal" DROP COLUMN IF EXISTS "searchVector";
ALTER TABLE "Deal" ADD COLUMN IF NOT EXISTS "bookingStage" TEXT;
ALTER TABLE "Deal" ADD COLUMN IF NOT EXISTS "costSheetId" TEXT;
ALTER TABLE "Deal" ADD COLUMN IF NOT EXISTS "paymentPlanId" TEXT;
ALTER TABLE "Deal" ADD COLUMN IF NOT EXISTS "unitId" TEXT;

ALTER TABLE "Organization" DROP COLUMN IF EXISTS "searchVector";
ALTER TABLE "Workspace" ADD COLUMN IF NOT EXISTS "settingsJson" JSONB;

-- CreateTable IF NOT EXISTS (Supabase branch idempotent)
CREATE TABLE IF NOT EXISTS "Project" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "reraNo" TEXT,
    "address" TEXT,
    "city" TEXT NOT NULL DEFAULT 'Ahmedabad',
    "type" TEXT NOT NULL DEFAULT 'RESIDENTIAL',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "Tower" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "floors" INTEGER NOT NULL DEFAULT 10,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Tower_pkey" PRIMARY KEY ("id")
);
CREATE TABLE IF NOT EXISTS "Floor" (
    "id" TEXT NOT NULL,
    "towerId" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    CONSTRAINT "Floor_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "Unit" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "floorId" TEXT,
    "unitNo" TEXT NOT NULL,
    "config" "UnitConfig" NOT NULL DEFAULT 'BHK2',
    "area" DOUBLE PRECISION,
    "carpetArea" DOUBLE PRECISION,
    "builtUp" DOUBLE PRECISION,
    "facing" TEXT,
    "price" DOUBLE PRECISION,
    "status" "UnitStatus" NOT NULL DEFAULT 'AVAILABLE',
    "holdUntil" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Unit_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "CostSheet" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "unitId" TEXT NOT NULL,
    "dealId" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "basePrice" DOUBLE PRECISION NOT NULL,
    "gst" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "stampDuty" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "otherCharges" JSONB,
    "total" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CostSheet_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "PaymentPlan" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PaymentPlan_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "PaymentMilestone" (
    "id" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "pct" DOUBLE PRECISION NOT NULL,
    "order" INTEGER NOT NULL,
    CONSTRAINT "PaymentMilestone_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "Payment" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "dealId" TEXT NOT NULL,
    "milestoneId" TEXT,
    "amount" DOUBLE PRECISION NOT NULL,
    "dueDate" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'DUE',
    "receiptNo" TEXT,
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "DocumentTemplate" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "kind" "DocumentKind" NOT NULL,
    "name" TEXT NOT NULL,
    "bodyHtml" TEXT NOT NULL,
    "reraAligned" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DocumentTemplate_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "GeneratedDocument" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "dealId" TEXT,
    "unitId" TEXT,
    "templateId" TEXT NOT NULL,
    "renderedHtml" TEXT NOT NULL,
    "pdfUrl" TEXT,
    "eSignStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "GeneratedDocument_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "WebhookEvent" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT,
    "source" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "dedupeKey" TEXT NOT NULL,
    "processedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WebhookEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "Project_workspaceId_idx" ON "Project"("workspaceId");
CREATE UNIQUE INDEX IF NOT EXISTS "Project_workspaceId_name_key" ON "Project"("workspaceId", "name");
CREATE INDEX IF NOT EXISTS "Tower_projectId_idx" ON "Tower"("projectId");
CREATE UNIQUE INDEX IF NOT EXISTS "Floor_towerId_number_key" ON "Floor"("towerId", "number");
CREATE INDEX IF NOT EXISTS "Unit_workspaceId_idx" ON "Unit"("workspaceId");
CREATE INDEX IF NOT EXISTS "Unit_projectId_idx" ON "Unit"("projectId");
CREATE INDEX IF NOT EXISTS "Unit_status_idx" ON "Unit"("status");
CREATE UNIQUE INDEX IF NOT EXISTS "Unit_projectId_unitNo_key" ON "Unit"("projectId", "unitNo");
CREATE INDEX IF NOT EXISTS "CostSheet_workspaceId_idx" ON "CostSheet"("workspaceId");
CREATE INDEX IF NOT EXISTS "CostSheet_unitId_idx" ON "CostSheet"("unitId");
CREATE INDEX IF NOT EXISTS "PaymentPlan_projectId_idx" ON "PaymentPlan"("projectId");
CREATE INDEX IF NOT EXISTS "PaymentMilestone_planId_idx" ON "PaymentMilestone"("planId");
CREATE INDEX IF NOT EXISTS "Payment_workspaceId_idx" ON "Payment"("workspaceId");
CREATE INDEX IF NOT EXISTS "Payment_dealId_idx" ON "Payment"("dealId");
CREATE INDEX IF NOT EXISTS "DocumentTemplate_workspaceId_kind_idx" ON "DocumentTemplate"("workspaceId", "kind");
CREATE INDEX IF NOT EXISTS "GeneratedDocument_workspaceId_idx" ON "GeneratedDocument"("workspaceId");
CREATE UNIQUE INDEX IF NOT EXISTS "WebhookEvent_dedupeKey_key" ON "WebhookEvent"("dedupeKey");
CREATE INDEX IF NOT EXISTS "WebhookEvent_source_processedAt_idx" ON "WebhookEvent"("source", "processedAt");

-- AddForeignKey (idempotent for Supabase re-deploy)
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Project_workspaceId_fkey') THEN ALTER TABLE "Project" ADD CONSTRAINT "Project_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE; END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Tower_projectId_fkey') THEN ALTER TABLE "Tower" ADD CONSTRAINT "Tower_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE; END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Floor_towerId_fkey') THEN ALTER TABLE "Floor" ADD CONSTRAINT "Floor_towerId_fkey" FOREIGN KEY ("towerId") REFERENCES "Tower"("id") ON DELETE CASCADE ON UPDATE CASCADE; END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Unit_workspaceId_fkey') THEN ALTER TABLE "Unit" ADD CONSTRAINT "Unit_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE; END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Unit_projectId_fkey') THEN ALTER TABLE "Unit" ADD CONSTRAINT "Unit_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE; END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Unit_floorId_fkey') THEN ALTER TABLE "Unit" ADD CONSTRAINT "Unit_floorId_fkey" FOREIGN KEY ("floorId") REFERENCES "Floor"("id") ON DELETE SET NULL ON UPDATE CASCADE; END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'CostSheet_workspaceId_fkey') THEN ALTER TABLE "CostSheet" ADD CONSTRAINT "CostSheet_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE; END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'CostSheet_unitId_fkey') THEN ALTER TABLE "CostSheet" ADD CONSTRAINT "CostSheet_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE CASCADE ON UPDATE CASCADE; END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'CostSheet_dealId_fkey') THEN ALTER TABLE "CostSheet" ADD CONSTRAINT "CostSheet_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "Deal"("id") ON DELETE SET NULL ON UPDATE CASCADE; END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PaymentPlan_projectId_fkey') THEN ALTER TABLE "PaymentPlan" ADD CONSTRAINT "PaymentPlan_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE; END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PaymentMilestone_planId_fkey') THEN ALTER TABLE "PaymentMilestone" ADD CONSTRAINT "PaymentMilestone_planId_fkey" FOREIGN KEY ("planId") REFERENCES "PaymentPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE; END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Payment_workspaceId_fkey') THEN ALTER TABLE "Payment" ADD CONSTRAINT "Payment_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE; END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Payment_dealId_fkey') THEN ALTER TABLE "Payment" ADD CONSTRAINT "Payment_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "Deal"("id") ON DELETE CASCADE ON UPDATE CASCADE; END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'DocumentTemplate_workspaceId_fkey') THEN ALTER TABLE "DocumentTemplate" ADD CONSTRAINT "DocumentTemplate_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE; END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'GeneratedDocument_workspaceId_fkey') THEN ALTER TABLE "GeneratedDocument" ADD CONSTRAINT "GeneratedDocument_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE; END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'GeneratedDocument_templateId_fkey') THEN ALTER TABLE "GeneratedDocument" ADD CONSTRAINT "GeneratedDocument_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "DocumentTemplate"("id") ON DELETE RESTRICT ON UPDATE CASCADE; END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'WebhookEvent_workspaceId_fkey') THEN ALTER TABLE "WebhookEvent" ADD CONSTRAINT "WebhookEvent_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE; END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Deal_unitId_fkey') THEN ALTER TABLE "Deal" ADD CONSTRAINT "Deal_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE SET NULL ON UPDATE CASCADE; END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Deal_paymentPlanId_fkey') THEN ALTER TABLE "Deal" ADD CONSTRAINT "Deal_paymentPlanId_fkey" FOREIGN KEY ("paymentPlanId") REFERENCES "PaymentPlan"("id") ON DELETE SET NULL ON UPDATE CASCADE; END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Deal_costSheetId_fkey') THEN ALTER TABLE "Deal" ADD CONSTRAINT "Deal_costSheetId_fkey" FOREIGN KEY ("costSheetId") REFERENCES "CostSheet"("id") ON DELETE SET NULL ON UPDATE CASCADE; END IF; END $$;
