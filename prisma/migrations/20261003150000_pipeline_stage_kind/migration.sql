-- AlterPipelineStage: add `kind`, the semantic role of a stage.
--
-- Why: `name` is a user-editable label, and the revenue logic branched on
-- `stage.name === 'Won'`. Renaming the stage to "Closed Won" — a perfectly
-- reasonable thing to do — silently stopped the dashboard recognising won deals,
-- with no error anywhere. `kind` is set once and survives renames.
--
-- Enum over a string column so the database itself rejects a typo: a bad value
-- fails at the write that caused it rather than becoming a stage that quietly
-- counts as open forever.
--
-- Deliberately plain DDL + UPDATE. No DO block, no dollar-quoted body: the
-- statement splitter that breaks these files on `;` will happily slice a
-- `$$ ... $$` body mid-statement and re-run the file from the top, which fails
-- on the first CREATE. Verification of the backfill lives in
-- `scripts/check-duplicates.ts`'s sibling concern — the dashboard unit tests and
-- the live-state check — not in the migration.
CREATE TYPE "StageKind" AS ENUM ('OPEN', 'WON', 'LOST');--> statement-breakpoint

ALTER TABLE "PipelineStage" ADD COLUMN "kind" "StageKind";--> statement-breakpoint

-- Backfill by name, case-insensitively.
--
-- This is the only signal available for stages that already exist, and it is
-- the same inference the code was doing implicitly all along — just done once,
-- on the row, where a later rename cannot invalidate it. Anything unmatched
-- becomes OPEN below, which is the safe direction to be wrong in: a stage
-- misread as open over-counts pipeline rather than under-reporting revenue.
--
-- The match is on the whole trimmed name, so a stage called "Lost Leads" — a
-- real thing in some pipelines — is not silently converted into a closed stage.
UPDATE "PipelineStage" SET "kind" = 'WON'  WHERE lower(btrim("name")) = 'won';--> statement-breakpoint
UPDATE "PipelineStage" SET "kind" = 'LOST' WHERE lower(btrim("name")) = 'lost';--> statement-breakpoint
UPDATE "PipelineStage" SET "kind" = 'OPEN' WHERE "kind" IS NULL;--> statement-breakpoint

ALTER TABLE "PipelineStage" ALTER COLUMN "kind" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "PipelineStage" ALTER COLUMN "kind" SET DEFAULT 'OPEN';