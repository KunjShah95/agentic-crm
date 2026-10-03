-- AlterDeal: add wonAt, the authoritative "when was this deal won" date.
--
-- Why: the dashboard bucketed won revenue by `updatedAt`, which moves every time
-- the row is edited. Renaming a won deal today moved ₹1 Cr of revenue into the
-- current month, and every deal written by a seed or import landed in the same
-- month as the import. This column is stamped once, on the transition into Won.
ALTER TABLE "Deal" ADD COLUMN "wonAt" TIMESTAMP(3);--> statement-breakpoint

-- Backfill for deals that were already closed when the column arrived.
--
-- `createdAt` is used because it is the only lower bound the row actually
-- carries: a deal cannot be won before it was created. It is an approximation
-- and will understate the time to close for any deal that sat in the pipeline
-- for months — that history is simply not recoverable, and inventing a more
-- flattering date would be worse than an honest one. Going forward `wonAt` is
-- exact, because it is written at the moment of the stage change.
--
-- Deliberately NOT `updatedAt`: that is the value this column exists to stop
-- relying on, and on the seeded rows it would reproduce the bug exactly.
UPDATE "Deal" AS d
SET "wonAt" = d."createdAt"
FROM "PipelineStage" AS s
WHERE d."stageId" = s."id"
  AND s."name" = 'Won'
  AND d."wonAt" IS NULL;--> statement-breakpoint

-- Partial: the only queries against this column ask "won deals in this window",
-- so rows in every other stage carry a guaranteed NULL that need not be indexed.
CREATE INDEX IF NOT EXISTS "Deal_workspaceId_wonAt_idx"
  ON "Deal"("workspaceId", "wonAt")
  WHERE "wonAt" IS NOT NULL;