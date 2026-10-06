/**
 * Standalone queue drain script.
 *
 * Manually processes pending WebhookEvent rows for a workspace. Useful for
 * debugging, backfills, or running outside the Vercel cron.
 *
 *   npx tsx scripts/drain-queue.ts <workspaceId> [limit]
 *
 * Exit code 0 on success, 1 on failure.
 */

import { readFileSync } from "node:fs"

// tsx does not load .env, and `@/lib/db` builds the pool at import time.
for (const file of [".env", ".env.local"]) {
  try {
    for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
      const match = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/.exec(line)
      if (!match) continue
      process.env[match[1]] ??= match[2].replace(/^["']|["']$/g, "")
    }
  } catch {
    // Absent env file is fine — CI and production set these directly.
  }
}

async function main() {
  const [workspaceId, limitArg] = process.argv.slice(2)

  if (!workspaceId) {
    console.error("Usage: npx tsx scripts/drain-queue.ts <workspaceId> [limit]")
    process.exit(1)
  }

  const limit = limitArg ? parseInt(limitArg, 10) : 50

  if (Number.isNaN(limit) || limit <= 0) {
    console.error(`Invalid limit: ${limitArg}`)
    process.exit(1)
  }

  const { processBatch, getQueueStats } = await import("@/modules/leadIngest/queue")
  const { db } = await import("@/lib/db")

  const before = await getQueueStats(workspaceId)
  console.log(
    `Queue: ${before.pending} pending, ${before.processed} processed, ${before.failed} failed`,
  )
  if (before.oldestPendingAt) {
    console.log(`Oldest pending: ${before.oldestPendingAt.toISOString()}`)
  }

  console.log(`\nProcessing up to ${limit} events...`)
  const result = await processBatch(workspaceId, limit)

  const after = await getQueueStats(workspaceId)

  console.log(`\n── Summary ──`)
  console.log(`  Processed: ${result.processed}`)
  console.log(`  Failed:    ${result.failed}`)
  console.log(`  Remaining: ${after.pending}`)

  await db.$disconnect()
  process.exit(result.failed > 0 ? 1 : 0)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
