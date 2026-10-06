-- CreateTable
CREATE TABLE IF NOT EXISTS "LeadSourceConfig" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "fieldMap" JSONB,
    "secretHash" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "trusted" BOOLEAN NOT NULL DEFAULT false,
    "autoAck" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LeadSourceConfig_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "LeadSourceConfig_workspaceId_source_key" ON "LeadSourceConfig"("workspaceId", "source");
CREATE INDEX IF NOT EXISTS "LeadSourceConfig_workspaceId_idx" ON "LeadSourceConfig"("workspaceId");

-- AddForeignKey
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'LeadSourceConfig_workspaceId_fkey') THEN ALTER TABLE "LeadSourceConfig" ADD CONSTRAINT "LeadSourceConfig_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE; END IF; END $$;
