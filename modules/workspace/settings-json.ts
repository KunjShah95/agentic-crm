import { db } from "@/lib/db"

/**
 * Merge top-level keys into `Workspace.settingsJson` in one statement.
 *
 * `settingsJson` is shared by several writers (lead-ingest secret, auto-ack,
 * API keys, WhatsApp binding, pipeline preferences). Read-then-write from two
 * of them at once lets the later write drop the earlier one's key. A single
 * `jsonb ||` UPDATE is atomic per row, so writers touching different keys can
 * no longer erase each other.
 *
 * A non-object value (SQL NULL, or a JSON `null` written by Prisma) is treated
 * as `{}`: `'null'::jsonb || '{...}'` would otherwise produce an array.
 */
export async function mergeWorkspaceSettings(
  workspaceId: string,
  patch: Record<string, unknown>
): Promise<void> {
  const json = JSON.stringify(patch)
  await db.$executeRaw`
    UPDATE "Workspace"
    SET "settingsJson" =
      (CASE WHEN jsonb_typeof("settingsJson") = 'object' THEN "settingsJson" ELSE '{}'::jsonb END)
      || ${json}::jsonb
    WHERE id = ${workspaceId}
  `
}
