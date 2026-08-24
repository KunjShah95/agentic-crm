-- CreateTable Subscription
CREATE TABLE "Subscription" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "stripeCustomerId" TEXT NOT NULL,
    "stripeSubId" TEXT,
    "plan" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "currentPeriodEnd" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Subscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable PlanLimits
CREATE TABLE "PlanLimits" (
    "plan" TEXT NOT NULL,
    "maxSeats" INTEGER NOT NULL,
    "maxContacts" INTEGER NOT NULL,
    "maxSocialAccounts" INTEGER NOT NULL,
    "msgPerMonth" INTEGER NOT NULL,
    "webhookPerDay" INTEGER NOT NULL,
    "agentCreditsPerMo" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "PlanLimits_pkey" PRIMARY KEY ("plan")
);

-- CreateTable SocialConnection
CREATE TABLE "SocialConnection" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "externalAccountId" TEXT NOT NULL,
    "displayName" TEXT,
    "accessTokenEnc" TEXT NOT NULL,
    "refreshTokenEnc" TEXT,
    "expiresAt" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'active',
    "lastSyncAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SocialConnection_pkey" PRIMARY KEY ("id")
);

-- CreateTable SocialEvent
CREATE TABLE "SocialEvent" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "dedupeKey" TEXT NOT NULL,
    "processedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SocialEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable UsageEvent
CREATE TABLE "UsageEvent" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "meta" JSONB,

    CONSTRAINT "UsageEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable UsageCounter
CREATE TABLE "UsageCounter" (
    "workspaceId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UsageCounter_pkey" PRIMARY KEY ("workspaceId","kind","period")
);

-- AlterTable Contact add handles
ALTER TABLE "Contact" ADD COLUMN "handles" JSONB;

-- AlterTable Activity add socialEventId
ALTER TABLE "Activity" ADD COLUMN "socialEventId" TEXT;

-- CreateIndex Subscription
CREATE UNIQUE INDEX "Subscription_workspaceId_key" ON "Subscription"("workspaceId");
CREATE UNIQUE INDEX "Subscription_stripeCustomerId_key" ON "Subscription"("stripeCustomerId");
CREATE UNIQUE INDEX "Subscription_stripeSubId_key" ON "Subscription"("stripeSubId");
CREATE INDEX "Subscription_status_idx" ON "Subscription"("status");

-- CreateIndex SocialConnection
CREATE UNIQUE INDEX "SocialConnection_workspaceId_provider_externalAccountId_key" ON "SocialConnection"("workspaceId", "provider", "externalAccountId");
CREATE INDEX "SocialConnection_provider_status_idx" ON "SocialConnection"("provider", "status");

-- CreateIndex SocialEvent
CREATE UNIQUE INDEX "SocialEvent_dedupeKey_key" ON "SocialEvent"("dedupeKey");
CREATE INDEX "SocialEvent_workspaceId_provider_idx" ON "SocialEvent"("workspaceId", "provider");

-- CreateIndex UsageEvent
CREATE INDEX "UsageEvent_workspaceId_kind_createdAt_idx" ON "UsageEvent"("workspaceId", "kind", "createdAt");

-- CreateIndex Activity new
CREATE INDEX "Activity_source_idx" ON "Activity"("source");
CREATE INDEX "Activity_socialEventId_idx" ON "Activity"("socialEventId");

-- AddForeignKey Subscription
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey SocialConnection
ALTER TABLE "SocialConnection" ADD CONSTRAINT "SocialConnection_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey SocialEvent
ALTER TABLE "SocialEvent" ADD CONSTRAINT "SocialEvent_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey UsageEvent
ALTER TABLE "UsageEvent" ADD CONSTRAINT "UsageEvent_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey UsageCounter
ALTER TABLE "UsageCounter" ADD CONSTRAINT "UsageCounter_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey Activity socialEvent
ALTER TABLE "Activity" ADD CONSTRAINT "Activity_socialEventId_fkey" FOREIGN KEY ("socialEventId") REFERENCES "SocialEvent"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Seed PlanLimits
INSERT INTO "PlanLimits" ("plan", "maxSeats", "maxContacts", "maxSocialAccounts", "msgPerMonth", "webhookPerDay", "agentCreditsPerMo") VALUES
  ('free', 1, 500, 1, 100, 500, 0),
  ('pro', 5, 5000, 3, 5000, 10000, 1000),
  ('scale', 15, 25000, 10, 25000, 50000, 10000)
ON CONFLICT ("plan") DO NOTHING;
