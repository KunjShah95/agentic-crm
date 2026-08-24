import { describe, expect, it, beforeAll, afterAll } from "vitest"

// Integration: Prisma queries against real Postgres (no mocks)
// Skipped when DATABASE_URL is not set — run with `vitest run tests/integration`
// Requires a test DB (e.g. TEST_DATABASE_URL or DATABASE_URL pointing to a throwaway DB)

import { db } from "@/lib/db"

const rawUrl = process.env.DATABASE_URL ?? ""
const isDummy = rawUrl.includes("test:test@localhost")
const hasDb = !!rawUrl && !isDummy

describe.skipIf(!hasDb)("integration: prisma queries (requires real DATABASE_URL)", () => {
  let workspaceId: string
  let userId: string

  beforeAll(async () => {
    // Create ephemeral workspace + user for the suite
    const user = await db.user.create({
      data: { email: `test-${Date.now()}@example.com`, name: "Test User" },
    })
    userId = user.id
    const workspace = await db.workspace.create({
      data: {
        name: `Test WS ${Date.now()}`,
        slug: `test-ws-${Date.now()}`,
        members: { create: { userId, role: "OWNER" } },
        stages: { create: [{ name: "Lead", color: "#64748b", order: 0 }] },
      },
    })
    workspaceId = workspace.id
  })

  afterAll(async () => {
    if (workspaceId) await db.workspace.delete({ where: { id: workspaceId } }).catch(() => {})
    if (userId) await db.user.delete({ where: { id: userId } }).catch(() => {})
    await db.$disconnect()
  })

  it("creates and queries a contact workspace-scoped", async () => {
    const contact = await db.contact.create({
      data: { workspaceId, firstName: "Ada", lastName: "Lovelace", createdBy: userId },
    })
    const found = await db.contact.findFirst({ where: { id: contact.id, workspaceId } })
    expect(found?.firstName).toBe("Ada")
    await db.contact.delete({ where: { id: contact.id } })
  })

  it("enforces workspace isolation on contacts", async () => {
    const otherWs = await db.workspace.create({
      data: { name: "Other", slug: `other-${Date.now()}`, stages: { create: [{ name: "Lead", color: "#64748b", order: 0 }] } },
    })
    const contact = await db.contact.create({
      data: { workspaceId: otherWs.id, firstName: "Bob", lastName: "", createdBy: userId },
    })
    const leaked = await db.contact.findFirst({ where: { id: contact.id, workspaceId } })
    expect(leaked).toBeNull()
    await db.contact.delete({ where: { id: contact.id } })
    await db.workspace.delete({ where: { id: otherWs.id } })
  })
})
