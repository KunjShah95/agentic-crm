import { db } from "@/lib/db"
import { PLAN_LIMITS } from "./limits"
import { AppError } from "@/lib/errors"

export function periodKey(d = new Date()): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`
}

export async function quotaExceeded(
  _workspaceId: string,
  _kind: string,
  limit: number,
  current: number
): Promise<boolean> {
  return current >= limit
}

export async function requireQuota(
  workspaceId: string,
  kind: "social_messages" | "webhook_events" | "contacts" | "seats"
): Promise<void> {
  const ws = await db.workspace.findUnique({
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

  const period = periodKey()
  const counter = await db.usageCounter.findUnique({
    where: { workspaceId_kind_period: { workspaceId, kind, period } },
  })
  if ((counter?.count ?? 0) >= key) {
    throw new AppError("QUOTA_EXCEEDED", `Quota exceeded for ${kind}. Upgrade to continue.`, 402)
  }
}

export async function incrementUsage(
  workspaceId: string,
  kind: string,
  count = 1
): Promise<void> {
  const period = periodKey()
  await db.$transaction([
    db.usageEvent.create({ data: { workspaceId, kind, count } }),
    db.usageCounter.upsert({
      where: { workspaceId_kind_period: { workspaceId, kind, period } },
      create: { workspaceId, kind, period, count },
      update: { count: { increment: count } },
    }),
  ])
}
