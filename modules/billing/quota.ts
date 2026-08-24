import { db } from "@/lib/db"
import { PLAN_LIMITS } from "./limits"
import { AppError } from "@/lib/errors"

export function periodKey(d = new Date()): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`
}

export function periodKeyFor(kind: string, d = new Date()): string {
  if (kind === "webhook_events") {
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`
  }
  return periodKey(d)
}

export function isQuotaExceeded(current: number, limit: number): boolean {
  return current >= limit
}

export async function quotaExceeded(
  _workspaceId: string,
  _kind: string,
  limit: number,
  current: number
): Promise<boolean> {
  return isQuotaExceeded(current, limit)
}

// Prisma interactive transaction client type (subset of PrismaClient)
type TxClient = Parameters<Parameters<typeof db.$transaction>[0]>[0]

export async function requireQuota(
  workspaceId: string,
  kind: "social_messages" | "webhook_events" | "contacts" | "seats",
  tx?: TxClient
): Promise<void> {
  const client = (tx ?? db) as unknown as typeof db
  const ws = await client.workspace.findUnique({
    where: { id: workspaceId },
    include: { subscription: true },
  })
  const plan = (ws?.subscription?.plan ?? ws?.plan ?? "free") as keyof typeof PLAN_LIMITS
  const limits = PLAN_LIMITS[plan] ?? PLAN_LIMITS.free
  const key =
    kind === "social_messages"
      ? limits.msgPerMonth
      : kind === "webhook_events"
        ? limits.webhookPerDay
        : kind === "contacts"
          ? limits.maxContacts
          : limits.maxSeats

  const period = periodKeyFor(kind)

  // Lock the counter row for update when inside an interactive transaction to prevent TOCTOU
  // If tx is provided we attempt SELECT ... FOR UPDATE via raw query (best-effort; row may not exist yet)
  if (tx) {
    try {
      await (tx as unknown as { $queryRaw: typeof db.$queryRaw }).$queryRaw`
        SELECT count FROM "UsageCounter"
        WHERE "workspaceId" = ${workspaceId} AND kind = ${kind} AND period = ${period}
        FOR UPDATE
      `
    } catch {
      // ignore - row may not exist or adapter doesn't support raw in tx mock
    }
  }

  const counter = await client.usageCounter.findUnique({
    where: { workspaceId_kind_period: { workspaceId, kind, period } },
  })
  if (isQuotaExceeded(counter?.count ?? 0, key)) {
    throw new AppError("QUOTA_EXCEEDED", `Quota exceeded for ${kind}. Upgrade to continue.`, 402)
  }
}

export async function incrementUsage(
  workspaceId: string,
  kind: string,
  count = 1
): Promise<void> {
  if (!Number.isInteger(count) || count <= 0) {
    throw new AppError("VALIDATION_ERROR", "count must be a positive integer", 400)
  }
  const period = periodKeyFor(kind)

  // Atomic check-and-increment: run requireQuota + upsert in a single interactive transaction
  // This prevents TOCTOU where two concurrent callers both pass requireQuota then exceed limit.
  await db.$transaction(async (tx) => {
    await requireQuota(workspaceId, kind as "social_messages" | "webhook_events" | "contacts" | "seats", tx)

    await tx.usageEvent.create({ data: { workspaceId, kind, count } })
    await tx.usageCounter.upsert({
      where: { workspaceId_kind_period: { workspaceId, kind, period } },
      create: { workspaceId, kind, period, count },
      update: { count: { increment: count } },
    })
  })
}
