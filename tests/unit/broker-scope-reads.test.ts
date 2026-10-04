import { describe, it, expect, beforeEach, vi } from "vitest"

/**
 * Behavioural broker scoping for the read paths closed in `6f3e1d6`'s follow-up.
 *
 * `broker-scope-registry.test.ts` proves the *structure* — that a scoped query
 * calls a filter helper. This proves the *effect*: that the predicate which
 * reaches Prisma actually carries the broker's id, and that it is absent for
 * every other role.
 *
 * The distinction matters. A structural check is satisfied by a filter call
 * whose result is computed and then dropped on the floor; only an assertion on
 * the `where` clause Prisma receives distinguishes "scoped" from "looks
 * scoped". So every test here reads the arguments the query was called with.
 */

const db = vi.hoisted(() => ({
  contact: { findMany: vi.fn(), count: vi.fn(), findFirst: vi.fn(), groupBy: vi.fn() },
  deal: { findMany: vi.fn(), count: vi.fn(), findFirst: vi.fn() },
  pipelineStage: { findMany: vi.fn() },
  project: { count: vi.fn(), findMany: vi.fn() },
  siteVisit: { count: vi.fn(), findMany: vi.fn() },
  activity: { count: vi.fn(), findMany: vi.fn(), findFirst: vi.fn() },
  unit: { count: vi.fn(), groupBy: vi.fn(), findMany: vi.fn() },
  payment: { findMany: vi.fn() },
  tag: { findMany: vi.fn() },
  workspaceMember: { findMany: vi.fn() },
  workspace: { findUnique: vi.fn() },
  organization: { findMany: vi.fn(), count: vi.fn(), findFirst: vi.fn() },
  generatedDocument: { findMany: vi.fn() },
  socialConnection: { findFirst: vi.fn() },
  broker: { findFirst: vi.fn() },
}))
vi.mock("@/lib/db", () => ({ db }))

import {
  getPipeline,
  listDealsForTable,
  getDealDetail,
  pipelineStats,
} from "@/modules/deals/queries"
import { listContacts, getContactDetail } from "@/modules/contacts/queries"
import { getDashboardData } from "@/modules/dashboard/queries"
import { askPipeline } from "@/modules/ai/ask"
import {
  getOrganizationDetail,
  getLinkableContacts,
} from "@/modules/organizations/queries"
import {
  getPipelineByStage,
  getDealsByOwner,
  getWinRateByDealType,
  getSourceROI,
} from "@/modules/reports/queries"
import { listSiteVisits } from "@/modules/siteVisits/queries"
import {
  listInboxContacts,
  listInboxContactsByChannel,
  getContactTimeline,
  getReplyContext,
} from "@/modules/whatsapp/queries"
import type { ViewerScope } from "@/lib/permissions"

const BROKER: ViewerScope = { workspaceId: "w1", role: "BROKER", brokerId: "cp-1" }
const OWNER: ViewerScope = { workspaceId: "w1", role: "OWNER", brokerId: null }

/** The `where` the named query was last called with. */
function whereOf(spy: { mock: { calls: unknown[][] } }): Record<string, unknown> {
  const call = spy.mock.calls[spy.mock.calls.length - 1]
  return (call?.[0] as { where?: Record<string, unknown> })?.where ?? {}
}

beforeEach(() => {
  vi.clearAllMocks()
  for (const delegate of Object.values(db)) {
    for (const fn of Object.values(delegate as Record<string, unknown>)) {
      if (typeof fn === "function") (fn as ReturnType<typeof vi.fn>).mockResolvedValue([])
    }
  }
  db.deal.count.mockResolvedValue(0)
  db.contact.count.mockResolvedValue(0)
  db.project.count.mockResolvedValue(0)
  db.siteVisit.count.mockResolvedValue(0)
  db.activity.count.mockResolvedValue(0)
  db.unit.count.mockResolvedValue(0)
  db.contact.groupBy.mockResolvedValue([])
  db.unit.groupBy.mockResolvedValue([])
  db.pipelineStage.findMany.mockResolvedValue([])
})

describe("deal reads are broker-scoped", () => {
  it("getPipeline narrows a BROKER to their own brokerId", async () => {
    await getPipeline(BROKER)
    expect(whereOf(db.deal.findMany).brokerId).toBe("cp-1")
  })

  it("listDealsForTable narrows a BROKER to their own brokerId", async () => {
    await listDealsForTable(BROKER)
    expect(whereOf(db.deal.findMany).brokerId).toBe("cp-1")
  })

  it("getDealDetail puts the broker predicate in the lookup, not a post-filter", async () => {
    await getDealDetail(BROKER, "d1")
    const where = whereOf(db.deal.findFirst)
    expect(where).toMatchObject({ id: "d1", workspaceId: "w1", brokerId: "cp-1" })
  })

  it("pipelineStats narrows a BROKER to their own brokerId", async () => {
    await pipelineStats(BROKER)
    expect(whereOf(db.deal.findMany).brokerId).toBe("cp-1")
  })

  it("a BROKER with no linked broker record matches nothing", async () => {
    // Fail-closed. An unmatchable brokerId is the whole point: a BROKER whose
    // Broker row was deleted must see an empty book, never everyone's.
    await getPipeline({ workspaceId: "w1", role: "BROKER", brokerId: null })
    expect(whereOf(db.deal.findMany).brokerId).toBe("__no_broker__")
  })

  it.each(["OWNER", "ADMIN", "MEMBER", "SALES", "VIEWER"] as const)(
    "adds no broker predicate for %s",
    async (role) => {
      await getPipeline({ workspaceId: "w1", role, brokerId: "cp-1" })
      expect(whereOf(db.deal.findMany).brokerId).toBeUndefined()
    },
  )
})

describe("contact reads are broker-scoped through the deals relation", () => {
  it("listContacts reaches the broker via the contact's deals", async () => {
    await listContacts(BROKER)
    // Contact has no brokerId column, so the predicate is relational. Asserting
    // the shape matters: a bare { brokerId } here would be rejected by Prisma
    // at runtime and, worse, would look correct in review.
    expect(whereOf(db.contact.findMany).deals).toEqual({
      some: { brokerId: "cp-1" },
    })
  })

  it("getContactDetail scopes both the parent row and the nested deals", async () => {
    await getContactDetail(BROKER, "c1")
    const args = db.contact.findFirst.mock.calls[0][0] as {
      where: Record<string, unknown>
      include: { deals: { where: Record<string, unknown> } }
    }
    expect(args.where.deals).toEqual({ some: { brokerId: "cp-1" } })
    // Scoping only the parent would leave a shared contact as a way to read
    // every deal on it, which is the leak the parent filter closes.
    expect(args.include.deals.where).toEqual({ brokerId: "cp-1" })
  })

  it("a BROKER with no linked broker record matches no contacts", async () => {
    await listContacts({ workspaceId: "w1", role: "BROKER", brokerId: null })
    expect(whereOf(db.contact.findMany).deals).toEqual({
      some: { brokerId: "__no_broker__" },
    })
  })

  it("adds no predicate for a non-BROKER role", async () => {
    await listContacts(OWNER)
    expect(whereOf(db.contact.findMany).deals).toBeUndefined()
  })
})

describe("dashboard rollups inherit broker scoping", () => {
  it("scopes the deal rollup and the contact rollup", async () => {
    await getDashboardData(BROKER)
    expect(whereOf(db.deal.count).brokerId).toBe("cp-1")
    expect(whereOf(db.deal.findMany).brokerId).toBe("cp-1")
    expect(whereOf(db.contact.count).deals).toEqual({ some: { brokerId: "cp-1" } })
  })

  it("scopes the top-deals panel", async () => {
    await getDashboardData(BROKER)
    const calls = db.deal.findMany.mock.calls
    const top = calls.find((c) => (c[0] as { take?: number }).take === 6)
    expect(top?.[0]).toMatchObject({ where: { brokerId: "cp-1" } })
  })

  it("keeps deal-less activity rows visible but hides other brokers' deal activity", async () => {
    await getDashboardData(BROKER)
    const where = whereOf(db.activity.findMany) as { OR?: unknown[] }
    expect(where.OR).toEqual([
      { dealId: null },
      { deal: { brokerId: "cp-1" } },
    ])
  })

  it("adds no predicates for an OWNER", async () => {
    await getDashboardData(OWNER)
    expect(whereOf(db.deal.count).brokerId).toBeUndefined()
    expect(whereOf(db.contact.count).deals).toBeUndefined()
    expect((whereOf(db.activity.findMany) as { OR?: unknown[] }).OR).toBeUndefined()
  })
})

describe("askPipeline inherits broker scoping", () => {
  it("scopes the funnel read", async () => {
    await askPipeline(BROKER, "show funnel")
    expect(whereOf(db.deal.findMany).brokerId).toBe("cp-1")
  })

  it("scopes overdue payments through their deal", async () => {
    // Payment has no brokerId of its own; the predicate belongs on the relation
    // or a broker reads the whole tenant's receivables.
    await askPipeline(BROKER, "overdue payments")
    expect(whereOf(db.payment.findMany).deal).toMatchObject({ brokerId: "cp-1" })
  })

  it("scopes the contacts intent", async () => {
    await askPipeline(BROKER, "recent contacts")
    expect(whereOf(db.contact.findMany).deals).toEqual({ some: { brokerId: "cp-1" } })
  })

  it("adds no predicates for an OWNER", async () => {
    await askPipeline(OWNER, "show funnel")
    expect(whereOf(db.deal.findMany).brokerId).toBeUndefined()
  })
})

describe("organization reads scope the nested relations, not the org row", () => {
  it("filters both contacts and deals on the detail page", async () => {
    await getOrganizationDetail(BROKER, "o1")
    const args = db.organization.findFirst.mock.calls[0][0] as {
      where: Record<string, unknown>
      include: { contacts: { where: unknown }; deals: { where: Record<string, unknown> } }
    }
    // The organization itself stays workspace-wide — it is shared master data.
    expect(args.where).toEqual({ id: "o1", workspaceId: "w1" })
    expect(args.include.contacts.where).toEqual({ deals: { some: { brokerId: "cp-1" } } })
    expect(args.include.deals.where).toEqual({ brokerId: "cp-1" })
  })

  it("scopes the auto-link suggestion list", async () => {
    await getLinkableContacts(BROKER, "shilp.co.in")
    expect(whereOf(db.contact.findMany).deals).toEqual({ some: { brokerId: "cp-1" } })
  })

  it("adds no relation predicates for an OWNER", async () => {
    await getOrganizationDetail(OWNER, "o1")
    const args = db.organization.findFirst.mock.calls[0][0] as {
      include: { contacts: { where: unknown }; deals: { where: unknown } }
    }
    expect(args.include.contacts.where).toEqual({})
    expect(args.include.deals.where).toEqual({})
  })
})

describe("report rollups inherit broker scoping", () => {
  it.each([
    ["getPipelineByStage", getPipelineByStage],
    ["getDealsByOwner", getDealsByOwner],
    ["getWinRateByDealType", getWinRateByDealType],
  ])("%s scopes its deal rollup", async (_name, fn) => {
    await fn(BROKER)
    expect(whereOf(db.deal.findMany).brokerId).toBe("cp-1")
  })

  it.each([
    ["getPipelineByStage", getPipelineByStage],
    ["getDealsByOwner", getDealsByOwner],
    ["getWinRateByDealType", getWinRateByDealType],
  ])("%s adds no predicate for an OWNER", async (_name, fn) => {
    await fn(OWNER)
    expect(whereOf(db.deal.findMany).brokerId).toBeUndefined()
  })

  it("getSourceROI scopes both the deal rollup and the lead-only contact query", async () => {
    // Seed a deal with a contactId: getSourceROI skips the by-id contact lookup
    // entirely when no deal carries a contact, so without this the assertion
    // would only ever see one of the two contact queries.
    db.deal.findMany.mockResolvedValue([
      { bookingStage: "BOOKING", value: 100, contactId: "c1" },
    ])
    await getSourceROI(BROKER)
    expect(whereOf(db.deal.findMany).brokerId).toBe("cp-1")
    // Two contact queries run: one keyed by the deal contactIds, one for
    // contacts with no deal. Both must be scoped.
    const contactWheres = db.contact.findMany.mock.calls.map((c) => (c[0] as { where: Record<string, unknown> }).where)
    expect(contactWheres).toHaveLength(2)
    for (const where of contactWheres) {
      expect(where.workspaceId).toBe("w1")
      expect(where.deals).toEqual({ some: { brokerId: "cp-1" } })
    }
  })

  it("getSourceROI's contactId lookup carries a workspace predicate", async () => {
    // Regression guard for a real gap: this query used to filter on
    // `{ id: { in: contactIds } }` with no workspaceId at all. The ids are
    // derived from a workspace-scoped deal set, so it was safe by derivation —
    // but a foreign contactId is accepted on deal create (see
    // docs/security/open-findings.md), and derivation is not a boundary.
    db.deal.findMany.mockResolvedValue([
      { bookingStage: "BOOKING", value: 100, contactId: "c1" },
    ])
    await getSourceROI(BROKER)
    const byId = db.contact.findMany.mock.calls
      .map((c) => (c[0] as { where: Record<string, unknown> }).where)
      .find((w) => w.id !== undefined)
    expect(byId).toBeDefined()
    expect(byId?.workspaceId).toBe("w1")
  })
})

describe("site visits scope through the visit's deal", () => {
  it("keeps deal-less visits but filters visits on other brokers' deals", async () => {
    await listSiteVisits(BROKER)
    expect(whereOf(db.siteVisit.findMany).OR).toEqual([
      { dealId: null },
      { deal: { workspaceId: "w1", brokerId: "cp-1" } },
    ])
  })

  it("applies no broker predicate for an OWNER", async () => {
    await listSiteVisits(OWNER)
    const where = whereOf(db.siteVisit.findMany)
    expect(where.OR).toBeUndefined()
    expect(where).toEqual({ workspaceId: "w1" })
  })
})

describe("inbox reads are broker-scoped", () => {
  it("scopes the contact list", async () => {
    await listInboxContacts(BROKER)
    expect(whereOf(db.contact.findMany).deals).toEqual({ some: { brokerId: "cp-1" } })
  })

  it("scopes the per-channel list", async () => {
    await listInboxContactsByChannel(BROKER, "WHATSAPP")
    expect(whereOf(db.contact.findMany).deals).toEqual({ some: { brokerId: "cp-1" } })
  })

  it("getContactTimeline returns nothing for a contact outside the broker's book", async () => {
    // The gate is a scoped contact lookup, so an arbitrary contactId renders
    // empty rather than another broker's messages.
    db.contact.findFirst.mockResolvedValue(null)
    const rows = await getContactTimeline(BROKER, "c_foreign")
    expect(rows).toEqual([])
    expect(db.activity.findMany).not.toHaveBeenCalled()
    expect(whereOf(db.contact.findFirst).deals).toEqual({ some: { brokerId: "cp-1" } })
  })

  it("getContactTimeline reads activities only once the contact is visible", async () => {
    db.contact.findFirst.mockResolvedValue({ id: "c1" })
    await getContactTimeline(BROKER, "c1")
    expect(db.activity.findMany).toHaveBeenCalledTimes(1)
  })

  it("getReplyContext does not read the reply window for an invisible contact", async () => {
    // Otherwise `lastInboundAt` discloses that a conversation exists on a
    // foreign id, which is a probe rather than a leak of content.
    db.contact.findFirst.mockResolvedValue(null)
    const ctx = await getReplyContext(BROKER, "c_foreign")
    expect(db.activity.findFirst).not.toHaveBeenCalled()
    expect(ctx.hasPhone).toBe(false)
    expect(ctx.lastInboundAt).toBeNull()
  })

  it("getReplyContext reads the window once the contact is visible", async () => {
    db.contact.findFirst.mockResolvedValue({ phone: "+919999999999", optedOut: false })
    await getReplyContext(BROKER, "c1")
    expect(db.activity.findFirst).toHaveBeenCalledTimes(1)
  })

  it("adds no predicate for an OWNER", async () => {
    await listInboxContacts(OWNER)
    expect(whereOf(db.contact.findMany).deals).toBeUndefined()
  })
})