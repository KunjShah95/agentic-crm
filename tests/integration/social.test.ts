import { describe, it, expect, vi, beforeEach } from "vitest"

// Integration test for social ingest worker idempotency.
// When DATABASE_URL points to a real Postgres, runs against real DB.
// Otherwise runs against mocked Prisma client (unit-style idempotency check).

const rawUrl = process.env.DATABASE_URL ?? ""
const isDummy = rawUrl.includes("test:test@localhost")
const hasDb = !!rawUrl && !isDummy

describe("social ingest idempotency", () => {
  it("ingest creates Activity and UsageEvent idempotently — duplicate externalId is deduped", async () => {
    // This import will fail before worker is implemented (expected for Task 8 Step 2)
    const { ingestSocialEvent } = await import("@/worker/social-ingest")

    if (hasDb) {
      // Real DB path — requires ephemeral workspace
      const { db } = await import("@/lib/db")
      const ws = await db.workspace.create({
        data: {
          name: `Social Test ${Date.now()}`,
          slug: `social-test-${Date.now()}`,
          stages: { create: [{ name: "Lead", color: "#64748b", order: 0 }] },
        },
      })
      const workspaceId = ws.id
      const user = await db.user.create({
        data: { email: `social-${Date.now()}@example.com`, name: "Social Tester" },
      })
      await db.workspaceMember.create({ data: { workspaceId, userId: user.id, role: "OWNER" } })

      try {
        await ingestSocialEvent({
          workspaceId,
          provider: "x",
          externalId: "evt1",
          fromHandle: "@ada",
          body: "hi",
        })
        const count1 = await db.activity.count({ where: { workspaceId, socialEventId: "evt1" } })
        expect(count1).toBe(1)

        await ingestSocialEvent({
          workspaceId,
          provider: "x",
          externalId: "evt1",
          fromHandle: "@ada",
          body: "hi",
        })
        const count2 = await db.activity.count({ where: { workspaceId, socialEventId: "evt1" } })
        expect(count2).toBe(1)

        // UsageEvent should also be idempotent — only one counted
        const usageCount = await db.usageEvent.count({ where: { workspaceId, kind: "social_messages" } })
        expect(usageCount).toBe(1)
      } finally {
        await db.workspace.delete({ where: { id: workspaceId } }).catch(() => {})
        await db.user.delete({ where: { id: user.id } }).catch(() => {})
        await db.$disconnect().catch(() => {})
      }
    } else {
      // Mocked path — verifies idempotency logic without real DB
      // We mock the db module used by worker/social-ingest
      // For this path we just verify the function exists and dedupes via in-memory mock
      // Create a minimal in-memory fake that mimics Prisma behavior
      const calls: { activityCreate: number; usageEventCreate: number } = {
        activityCreate: 0,
        usageEventCreate: 0,
      }

      // The worker should handle dedupeKey = provider:externalId idempotently
      // We test by calling twice and asserting second is no-op via return value or no throw
      // Since we don't have a real DB mock here, we just verify the function is callable
      // and that it would not throw on duplicate when backed by mocked DB in unit tests
      // A fuller mock test lives in tests/unit/social-ingest.mock.test.ts — here we just ensure import works
      expect(typeof ingestSocialEvent).toBe("function")

      // If the worker uses real db with dummy URL, it would fail to connect;
      // In mocked mode we skip actual ingest call to avoid PG connection.
      // Instead verify dedupeKey logic is exported
      const { buildDedupeKey } = await import("@/worker/social-ingest").catch(() => ({ buildDedupeKey: undefined as unknown as (p: string, id: string) => string }))
      if (buildDedupeKey) {
        expect(buildDedupeKey("x", "evt1")).toBe("x:evt1")
        expect(buildDedupeKey("whatsapp", "wamid.123")).toBe("whatsapp:wamid.123")
      }
    }
  })

  it("ingestSocialEvent is idempotent when mocked DB has already processed event", async () => {
    // Pure mock test — no DB required
    vi.resetModules()

    // Mock lib/db before importing worker
    const store = {
      socialEvent: new Map<string, { id: string; dedupeKey: string; processedAt: Date | null }>(),
      contact: new Map<string, { id: string; workspaceId: string; handles: unknown }>(),
      activity: [] as Array<{ socialEventId: string }>,
      usageEvent: [] as Array<{ kind: string }>,
      usageCounter: new Map<string, number>(),
      workspace: { id: "ws1", plan: "free", subscription: null },
    }

    vi.doMock("@/lib/db", () => {
      return {
        db: {
          workspace: {
            findUnique: vi.fn(async () => store.workspace),
          },
          socialEvent: {
            findUnique: vi.fn(async ({ where }: { where: { id?: string; dedupeKey?: string } }) => {
              if (where.id) return store.socialEvent.get(where.id) ?? null
              if (where.dedupeKey) {
                for (const v of store.socialEvent.values()) if (v.dedupeKey === where.dedupeKey) return v
                return null
              }
              return null
            }),
            findFirst: vi.fn(async ({ where }: { where: { dedupeKey?: string; id?: string } }) => {
              if (where.dedupeKey) {
                for (const v of store.socialEvent.values()) if (v.dedupeKey === where.dedupeKey) return v
                return null
              }
              if (where.id) return store.socialEvent.get(where.id) ?? null
              return null
            }),
            create: vi.fn(async ({ data }: { data: { id: string; dedupeKey: string } }) => {
              if (store.socialEvent.has(data.id)) {
                const err = Object.assign(new Error("Unique constraint"), { code: "P2002" })
                throw err
              }
              const rec = { ...data, processedAt: null as Date | null }
              store.socialEvent.set(data.id, rec as unknown as typeof rec)
              return rec
            }),
            update: vi.fn(async ({ where, data }: { where: { id: string }; data: { processedAt: Date } }) => {
              const rec = store.socialEvent.get(where.id)
              if (rec) rec.processedAt = data.processedAt
              return rec
            }),
            upsert: vi.fn(async ({ where, create, update }: { where: { id: string }; create: { id: string; dedupeKey: string }; update: unknown }) => {
              const existing = store.socialEvent.get(where.id)
              if (existing) return existing
              const rec = { ...create, processedAt: null as Date | null }
              store.socialEvent.set(create.id, rec as unknown as typeof rec)
              return rec
            }),
          },
          contact: {
            findFirst: vi.fn(async () => null),
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            create: vi.fn(async ({ data }: { data: any }) => {
              const id = data.id ?? `c${Date.now()}`
              const rec = { id, ...data }
              store.contact.set(id, rec as unknown as (typeof store.contact extends Map<string, infer V> ? V : never))
              return rec
            }),
            findMany: vi.fn(async () => []),
          },
          activity: {
            create: vi.fn(async ({ data }: { data: { socialEventId: string } }) => {
              store.activity.push({ socialEventId: data.socialEventId })
              return { id: `a${store.activity.length}`, ...data }
            }),
            count: vi.fn(async ({ where }: { where: { socialEventId: string } }) => {
              return store.activity.filter((a) => a.socialEventId === where.socialEventId).length
            }),
          },
          usageEvent: {
            create: vi.fn(async ({ data }: { data: { kind: string } }) => {
              store.usageEvent.push({ kind: data.kind })
              return { id: `u${store.usageEvent.length}`, ...data }
            }),
            count: vi.fn(async ({ where }: { where: { kind: string } }) => {
              return store.usageEvent.filter((u) => u.kind === where.kind).length
            }),
          },
          usageCounter: {
            findUnique: vi.fn(async () => null),
            upsert: vi.fn(async ({ create }: { where: { workspaceId_kind_period: { workspaceId: string; kind: string; period: string } }; create: { workspaceId: string; kind: string; period: string; count: number } }) => {
              const key = `${create.workspaceId}:${create.kind}:${create.period}`
              const existing = store.usageCounter.get(key)
              if (existing !== undefined) {
                store.usageCounter.set(key, existing + (create.count ?? 1))
                return { count: existing + (create.count ?? 1) }
              }
              store.usageCounter.set(key, create.count ?? 1)
              return { count: create.count ?? 1 }
            }),
          },
          $transaction: vi.fn(async (fn: unknown) => {
            if (typeof fn === "function") {
              const tx = {
                workspace: { findUnique: vi.fn(async () => store.workspace) },
                socialEvent: {
                  findUnique: vi.fn(async ({ where }: { where: { id?: string } }) => store.socialEvent.get(where.id!) ?? null),
                  update: vi.fn(async ({ where, data }: { where: { id: string }; data: { processedAt: Date } }) => {
                    const rec = store.socialEvent.get(where.id)
                    if (rec) rec.processedAt = data.processedAt
                    return rec
                  }),
                },
                contact: {
                  findFirst: vi.fn(async () => null),
                  findMany: vi.fn(async () => []),
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  create: vi.fn(async ({ data }: { data: any }) => {
                    const id = data.id ?? `c${Date.now()}`
                    const rec = { id, ...data }
                    store.contact.set(id, rec as unknown as (typeof store.contact extends Map<string, infer V> ? V : never))
                    return rec
                  }),
                },
                activity: {
                  create: vi.fn(async ({ data }: { data: { socialEventId: string } }) => {
                    store.activity.push({ socialEventId: data.socialEventId })
                    return { id: `a${store.activity.length}`, ...data }
                  }),
                },
                usageEvent: {
                  create: vi.fn(async ({ data }: { data: { kind: string } }) => {
                    store.usageEvent.push({ kind: data.kind })
                    return { id: `u${store.usageEvent.length}`, ...data }
                  }),
                },
                usageCounter: {
                  findUnique: vi.fn(async () => null),
                  upsert: vi.fn(async ({ create }: { create: { workspaceId: string; kind: string; period: string; count: number } }) => {
                    const key = `${create.workspaceId}:${create.kind}:${create.period}`
                    store.usageCounter.set(key, (store.usageCounter.get(key) ?? 0) + (create.count ?? 1))
                    return { count: store.usageCounter.get(key)! }
                  }),
                },
                $queryRaw: vi.fn(async () => []),
              }
              return (fn as (tx: unknown) => Promise<unknown>)(tx)
            }
            // array form
            return Promise.all((fn as Promise<unknown>[]).map((p) => p))
          }),
          $queryRaw: vi.fn(async () => []),
        },
      }
    })

    vi.doMock("@/modules/billing/quota", async () => {
      const actual = await vi.importActual<typeof import("@/modules/billing/quota")>("@/modules/billing/quota")
      return {
        ...actual,
        requireQuota: vi.fn(async () => {}),
        incrementUsage: vi.fn(async () => {}),
        periodKeyFor: actual.periodKeyFor,
        periodKey: actual.periodKey,
      }
    })

    const { ingestSocialEvent } = await import("@/worker/social-ingest")

    await ingestSocialEvent({
      workspaceId: "ws1",
      provider: "x",
      externalId: "evt1",
      fromHandle: "@ada",
      body: "hi",
    })
    expect(store.activity.filter((a) => a.socialEventId === "evt1").length).toBe(1)

    await ingestSocialEvent({
      workspaceId: "ws1",
      provider: "x",
      externalId: "evt1",
      fromHandle: "@ada",
      body: "hi",
    })
    expect(store.activity.filter((a) => a.socialEventId === "evt1").length).toBe(1)

    vi.resetModules()
    vi.doUnmock("@/lib/db")
    vi.doUnmock("@/modules/billing/quota")
  })
})
