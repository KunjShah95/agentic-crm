-- AlterDeal: add dealType (commission category) and urgency (uplift driver)
ALTER TABLE "Deal" ADD COLUMN "dealType" TEXT;--> statement-breakpoint
ALTER TABLE "Deal" ADD COLUMN "urgency" TEXT NOT NULL DEFAULT 'NORMAL';--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "Deal_urgency_idx" ON "Deal"("urgency");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "Deal_dealType_idx" ON "Deal"("dealType");
