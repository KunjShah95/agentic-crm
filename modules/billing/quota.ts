import { db } from "@/lib/db"
import { PLAN_LIMITS, UNLIMITED, resolveEffectivePlan } from "./limits"
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
  // Trial-aware: Team limits for 14 days from creation, then Free unless paid.
  const plan = ws
    ? resolveEffectivePlan({ ...ws, createdAt: ws.createdAt ?? new Date(0) }, ws.subscription).plan
    : "free"
  const limits = PLAN_LIMITS[plan] ?? PLAN_LIMITS.free
  const key =
    kind === "social_messages"
      ? limits.msgPerMonth
      : kind === "webhook_events"
        ? limits.webhookPerDay
        : kind === "contacts"
          ? limits.maxContacts
          : limits.maxSeats

  if (kind === "seats") {
    await assertSeatAvailable(client, workspaceId, key)
    return
  }

  // Contacts are a headcount too. Contact creation never incremented the
  // "contacts" counter, so a monthly counter read here was always 0 and the
  // Free limit after a trial never bit. Count the rows that exist.
  if (kind === "contacts") {
    if (key === UNLIMITED) return
    const total = await client.contact.count({ where: { workspaceId } })
    if (isQuotaExceeded(total, key)) {
      throw new AppError(
        "QUOTA_EXCEEDED",
        `Your plan includes ${key.toLocaleString("en-IN")} contacts. Upgrade to add more.`,
        402
      )
    }
    return
  }

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

/**
 * Seat admission: members plus unexpired pending invites must stay under the
 * plan's seat count.
 *
 * When `client` is a transaction, a per-workspace advisory lock is taken first
 * so two concurrent invites (or acceptances) cannot both read the same free
 * seat. The lock is released when the transaction ends. Outside a transaction
 * the check is best-effort, which is why the invite and accept paths call this
 * from inside one.
 *
 * `acceptingInviteId` is for the accept path: that invite already holds a
 * reservation and is about to turn into a member, so it is excluded from the
 * pending count and the new member is counted instead.
 */
export async function assertSeatAvailable(
  client: typeof db | TxClient,
  workspaceId: string,
  limit?: number,
  opts: { acceptingInviteId?: string } = {}
): Promise<void> {
  const c = client as unknown as typeof db
  if (client !== db) {
    await c.$executeRaw`SELECT 1 FROM (SELECT pg_advisory_xact_lock(hashtext(${"seats:" + workspaceId}))) AS l`
  }

  let max = limit
  if (max === undefined) {
    const ws = await c.workspace.findUnique({ where: { id: workspaceId }, include: { subscription: true } })
    const plan = ws
    ? resolveEffectivePlan({ ...ws, createdAt: ws.createdAt ?? new Date(0) }, ws.subscription).plan
    : "free"
    max = (PLAN_LIMITS[plan] ?? PLAN_LIMITS.free).maxSeats
  }

  const [members, pending] = await Promise.all([
    c.workspaceMember.count({ where: { workspaceId } }),
    c.workspaceInvite.count({
      where: {
        workspaceId,
        accepted: false,
        expiresAt: { gt: new Date() },
        ...(opts.acceptingInviteId ? { id: { not: opts.acceptingInviteId } } : {}),
      },
    }),
  ])
  // Inviting: the new invite needs a seat. Accepting: the new member does.
  if (isQuotaExceeded(members + pending, max)) {
    throw new AppError(
      "QUOTA_EXCEEDED",
      `This workspace's plan includes ${max} seat${max === 1 ? "" : "s"}. An owner or admin needs to upgrade before anyone else can join.`,
      402
    )
  }
}
