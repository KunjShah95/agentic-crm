-- Two-way WhatsApp rail: provider message ids, delivery receipts, and the
-- tenant-resolution key for inbound webhooks.
--
-- Background: the inbox was read-only and inbound messages had nowhere to be
-- attributed. These columns make a reply round-trip possible and idempotent:
--   * Activity.externalId  -> the wamid, so a `statuses` webhook can find the
--                             outbound bubble it belongs to.
--   * Activity.status      -> sent | delivered | read | failed for the tick UI.
--   * Activity.statusAt    -> monotonic guard so a duplicate/late receipt cannot
--                             move a bubble backwards (read -> delivered).
--   * SocialConnection.metadata -> { phoneNumberId, wabaId } which is how an
--                             inbound batch is mapped to a workspace.

-- AlterTable
ALTER TABLE "Activity" ADD COLUMN     "externalId" TEXT,
ADD COLUMN     "status" TEXT,
ADD COLUMN     "statusAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "SocialConnection" ADD COLUMN     "metadata" JSONB;

-- CreateIndex
CREATE INDEX "Activity_externalId_idx" ON "Activity"("externalId");

-- CreateIndex
CREATE INDEX "Activity_contactId_direction_createdAt_idx" ON "Activity"("contactId", "direction", "createdAt");

-- CreateIndex
CREATE INDEX "SocialConnection_provider_externalAccountId_idx" ON "SocialConnection"("provider", "externalAccountId");
