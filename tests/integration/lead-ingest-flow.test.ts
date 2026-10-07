import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import type { Mock } from "vitest"

/**
 * End-to-end integration tests for the lead ingest flow:
 *
 *   webhook POST body → enqueueLead() → WebhookEvent row (processedAt = null)
 *   → processBatch() → Contact + Deal + Activities → processedAt set
 *
 * The db double follows the project convention (vi.hoisted + vi.mock), with
 * one deliberate extension: `webhookEvent` is a stateful in-memory fake
 * rather than a bag of pre-set return values. These tests are about *state
 * transitions* — pending → processed, dedupeKey uniqueness, queue depth —
 * and driving them through pre-set mock return values would make the stats
 * assertions circular (the test would supply the very numbers it asserts).
 * The fake keeps the real query shapes (findUnique / findFirst / findMany /
 * count / create / update with the same where-clause semantics as Prisma).
 *
 * mockClear is used instead of the usual mockReset because mockReset strips
 * a vi.fn(impl)'s implementation — the stateful fns need theirs. The simple
 * mocks get their default return values re-set in beforeEach anyway.
 */

type FakeEvent = {
  id: string
  workspaceId: string
  source: string
  payload: unknown
  dedupeKey: string
  processedAt: Date | null
  createdAt: Date
}

const h = vi.hoisted(() => {
  const events: FakeEvent[] = []
  let seq = 0

  const byDedupeKey = (key: string) => events.find((e) => e.dedupeKey === key) ?? null
  const pendingFor = (workspaceId: string) =>
    events
      .filter((e) => e.workspaceId === workspaceId && e.processedAt === null)
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())

  const db = {
    webhookEvent: {
      findUnique: vi.fn(async ({ where }: { where: { dedupeKey: string } }) => byDedupeKey(where.dedupeKey)),
      findFirst: vi.fn(async (args: { where: { workspaceId: string; processedAt: null }; select?: { createdAt: boolean } }) => {
        const oldest = pendingFor(args.where.workspaceId)[0]
        if (!oldest) return null
        return args.select ? { createdAt: oldest.createdAt } : oldest
      }),
      findMany: vi.fn(async (args: { where: { workspaceId: string; processedAt: null }; take?: number }) =>
        pendingFor(args.where.workspaceId).slice(0, args.take ?? undefined)
      ),
      create: vi.fn(async ({ data }: { data: { workspaceId: string; source: string; payload: unknown; dedupeKey: string } }) => {
        const event: FakeEvent = { id: `we-${++seq}`, processedAt: null, createdAt: new Date(), ...data }
        events.push(event)
        return event
      }),
      update: vi.fn(async ({ where, data }: { where: { dedupeKey: string }; data: { processedAt: Date; workspaceId?: string } }) => {
        const event = byDedupeKey(where.dedupeKey)
        if (!event) throw new Error(`WebhookEvent not found: ${where.dedupeKey}`)
        if (data.processedAt !== undefined) event.processedAt = data.processedAt
        if (data.workspaceId !== undefined) event.workspaceId = data.workspaceId
        return event
      }),
      count: vi.fn(async (args: { where: { workspaceId: string; processedAt: null | { not: null } } }) => {
        const inWs = events.filter((e) => e.workspaceId === args.where.workspaceId)
        return args.where.processedAt === null
          ? inWs.filter((e) => e.processedAt === null).length
          : inWs.filter((e) => e.processedAt !== null).length
      }),
    },
    contact: { findFirst: vi.fn(), create: vi.fn(), update: vi.fn() },
    pipelineStage: { findFirst: vi.fn() },
    deal: { create: vi.fn(), count: vi.fn() },
    activity: { create: vi.fn() },
    workspaceMember: { findMany: vi.fn() },
    workspace: { findUnique: vi.fn() },
    leadSourceConfig: { findUnique: vi.fn() },
  }
  return { db, events }
})

vi.mock("@/lib/db", () => ({ db: h.db }))

import { enqueueLead, processBatch, getQueueStats } from "@/modules/leadIngest/queue"
import { processLead } from "@/modules/leadIngest/worker"

const db = h.db
const events = h.events

/** Mirrors the POST body the webhook route parses and passes to enqueueLead(). */
const LEAD = {
  lead_id: "99-9",
  name: "Meera Shah",
  phone: "+919800000000",
  config: "3BHK",
  intent: "HOT",
  locality: "Bopal",
  budget: "80-90 Lakh",
}

/**
 * Outbound activity channels only. The follow-up scheduler also uses the
 * WHATSAPP channel for its first two tasks (they are WhatsApp-related to-dos,
 * directionless), so gating assertions must look at direction = "OUT" —
 * that is the auto-ack record and the only irreversible outbound message.
 */
function outboundChannels() {
  return db.activity.create.mock.calls
    .map((c) => c[0].data)
    .filter((d) => d.direction === "OUT")
    .map((d) => d.channel)
}

function autoAckOff() {
  db.workspace.findUnique.mockResolvedValue({ settingsJson: {} })
}

function autoAckOn() {
  db.workspace.findUnique.mockResolvedValue({ settingsJson: { leadIngest: { autoAck: true } } })
}

beforeEach(() => {
  events.length = 0
  Object.values(db).forEach((model) =>
    Object.values(model).forEach((fn) => (fn as Mock).mockClear()),
  )
  db.contact.findFirst.mockResolvedValue(null)
  db.contact.create.mockResolvedValue({ id: "c1", firstName: "Meera", lastName: "Shah", phone: "+919800000000", optedOut: false })
  db.contact.update.mockResolvedValue({ id: "c1" })
  db.pipelineStage.findFirst.mockResolvedValue({ id: "stage1" })
  db.deal.create.mockResolvedValue({ id: "d1" })
  db.deal.count.mockResolvedValue(0)
  db.activity.create.mockResolvedValue({ id: "a1" })
  db.workspaceMember.findMany.mockResolvedValue([{ userId: "u1" }])
  // No per-source config rows by default — the worker falls back to the
  // input/workspace-level trusted + autoAck gates.
  db.leadSourceConfig.findUnique.mockResolvedValue(null)
  autoAckOff()
})

describe("lead ingest flow: webhook → enqueue → worker", () => {
  it("full flow: enqueue → pending WebhookEvent → processBatch → contact + deal + activities → processedAt set", async () => {
    // The webhook route parses the POST body and calls enqueueLead(ws.id, source, body, true).
    const { eventId, dedupeKey } = await enqueueLead("w1", "ninety_nine_acres", LEAD, true)

    // A WebhookEvent row was created, pending (processedAt = null).
    expect(eventId).toBe("we-1")
    expect(dedupeKey).toBe("NINETY_NINE_ACRES:99-9")
    expect(events).toHaveLength(1)
    expect(events[0].processedAt).toBeNull()
    expect(events[0].source).toBe("NINETY_NINE_ACRES")
    expect(events[0].workspaceId).toBe("w1")
    expect(events[0].payload).toMatchObject(LEAD)

    let stats = await getQueueStats("w1")
    expect(stats.pending).toBe(1)
    expect(stats.processed).toBe(0)

    const result = await processBatch("w1")
    expect(result).toEqual({ processed: 1, failed: 0 })

    // Contact created with score + source.
    expect(db.contact.create).toHaveBeenCalledTimes(1)
    const contactData = db.contact.create.mock.calls[0][0].data
    expect(contactData.leadSource).toBe("NINETY_NINE_ACRES")
    expect(contactData.leadScore).toBe(82)

    // Deal created in the first pipeline stage, linked to the contact.
    expect(db.deal.create).toHaveBeenCalledTimes(1)
    const dealData = db.deal.create.mock.calls[0][0].data
    expect(dealData.title).toBe("Meera Shah")
    expect(dealData.contactId).toBe("c1")
    expect(dealData.stageId).toBe("stage1")

    // Activities: inbound LEAD + 3 follow-ups (hot cadence) + AUDIT.
    // No outbound WHATSAPP — the workspace opt-in alone cannot ack here
    // (trusted is not persisted through the queue).
    const activityData = db.activity.create.mock.calls.map((c) => c[0].data)
    expect(activityData.find((d) => d.channel === "LEAD")).toMatchObject({ direction: "IN" })
    expect(activityData.filter((d) => d.source === "agent")).toHaveLength(3)
    expect(activityData.find((d) => d.channel === "AUDIT")).toBeDefined()
    expect(outboundChannels()).not.toContain("WHATSAPP")

    // The event is now marked processed.
    expect(events[0].processedAt).toBeInstanceOf(Date)
    stats = await getQueueStats("w1")
    expect(stats.pending).toBe(0)
    expect(stats.processed).toBe(1)
  })
})

describe("lead ingest dedupe", () => {
  it("the same payload enqueued twice produces one event row and one contact", async () => {
    const first = await enqueueLead("w1", "ninety_nine_acres", LEAD, true)
    const second = await enqueueLead("w1", "ninety_nine_acres", LEAD, true)

    // Same dedupeKey → the second enqueue returns the existing row, no insert.
    expect(second.dedupeKey).toBe(first.dedupeKey)
    expect(second.eventId).toBe(first.eventId)
    expect(events).toHaveLength(1)

    const result = await processBatch("w1")
    expect(result).toEqual({ processed: 1, failed: 0 })
    expect(db.contact.create).toHaveBeenCalledTimes(1)
    expect(events[0].processedAt).toBeInstanceOf(Date)
  })
})

describe("enterprise source onboarding", () => {
  it("stores a custom company slug canonicalized, scores the lead, and carries the source to the contact", async () => {
    await enqueueLead("w1", "acme-crm", {
      record_id: "ACME-1042",
      contact_name: "Asha Shah",
      mobileNumber: "+919820012345",
      expected_budget: "55-70 Lakh",
      unitType: "2BHK",
      preferredLocation: "Bopal",
    })

    // acme-crm → ACME_CRM, stored on the event.
    expect(events).toHaveLength(1)
    expect(events[0].source).toBe("ACME_CRM")
    expect(events[0].dedupeKey).toBe("ACME_CRM:ACME-1042")

    await processBatch("w1")

    // Scored, not zero: 30 base + 6 enterprise pipe + 0 intent + 10 config + 10 budget.
    expect(db.contact.create).toHaveBeenCalledTimes(1)
    const data = db.contact.create.mock.calls[0][0].data
    expect(data.leadSource).toBe("ACME_CRM")
    expect(data.leadScore).toBe(56)
  })
})

/**
 * Auto-ack gating.
 *
 * The queue path deliberately never triggers the WhatsApp auto-ack via the
 * workspace opt-in: enqueueLead() accepts `trusted` for signature
 * compatibility with the webhook route but does not persist it (WebhookEvent
 * has no `trusted` column), and processBatch() calls processLead() without
 * it. A lead captured asynchronously is therefore not eligible for outbound
 * messaging on the workspace gate alone — it cannot make the workspace's
 * business number message a stranger.
 *
 * The one queue-path exception is a per-source LeadSourceConfig row marking
 * the source trusted + autoAck: that is an explicit, DB-backed decision by
 * the workspace owner, so it is honoured even asynchronously.
 */
describe("auto-ack gating", () => {
  it("creates no WhatsApp activity when the workspace has not opted in, even with trusted: true", async () => {
    autoAckOff()
    await enqueueLead("w1", "ninety_nine_acres", LEAD, true)
    await processBatch("w1")
    expect(outboundChannels()).not.toContain("WHATSAPP")
  })

  it("still creates no WhatsApp activity through the queue on the workspace opt-in alone", async () => {
    autoAckOn()
    await enqueueLead("w1", "ninety_nine_acres", LEAD, true)
    await processBatch("w1")
    expect(outboundChannels()).not.toContain("WHATSAPP")
    // The lead itself is still captured — suppressing outbound must never
    // cost us the lead.
    expect(db.contact.create).toHaveBeenCalledTimes(1)
  })

  it("creates the WhatsApp activity when a per-source config marks the source trusted with autoAck", async () => {
    // Per-source config overrides the input/workspace gates: a source marked
    // trusted + autoAck in LeadSourceConfig is eligible even on the async queue.
    db.leadSourceConfig.findUnique.mockResolvedValue({
      source: "ninety_nine_acres",
      fieldMap: null,
      secretHash: null,
      enabled: true,
      trusted: true,
      autoAck: true,
    })
    await enqueueLead("w1", "ninety_nine_acres", LEAD, true)
    await processBatch("w1")
    const out = db.activity.create.mock.calls.find(
      (c) => c[0].data.channel === "WHATSAPP" && c[0].data.direction === "OUT"
    )
    expect(out).toBeDefined()
    expect(out![0].data.body).toContain("Meera")
  })

  it("creates the WhatsApp activity when both gates pass (trusted ingress + opt-in)", async () => {
    // The synchronous path is the only one that can express "trusted" without
    // a per-source config row. WhatsApp is unconfigured in tests, so the
    // adapter throws and the worker records the not-sent attempt on the
    // timeline (channel WHATSAPP, direction OUT); the intent is what we assert.
    autoAckOn()
    await processLead({ workspaceId: "w1", source: "ninety_nine_acres", payload: LEAD, trusted: true })
    const out = db.activity.create.mock.calls.find(
      (c) => c[0].data.channel === "WHATSAPP" && c[0].data.direction === "OUT"
    )
    expect(out).toBeDefined()
    expect(out![0].data.body).toContain("Meera")
  })
})

describe("follow-up scheduling", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] })
    vi.setSystemTime(new Date("2026-01-01T00:00:00Z"))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  const DAY_MS = 24 * 60 * 60 * 1000
  const BASE = new Date("2026-01-01T00:00:00Z").getTime()

  function followUpRows() {
    return db.activity.create.mock.calls
      .map((c) => c[0].data)
      .filter((d) => d.source === "agent")
  }

  function followUpOffsets(): number[] {
    return followUpRows().map((d) => (d.scheduledAt.getTime() - BASE) / DAY_MS)
  }

  it("hot lead (score >= 70) gets the [1,3,7] day cadence", async () => {
    // LEAD scores 82 → hot band.
    await enqueueLead("w1", "ninety_nine_acres", LEAD, true)
    await processBatch("w1")
    const rows = followUpRows()
    expect(rows).toHaveLength(3)
    expect(rows.map((r) => r.type)).toEqual(["CALL", "TASK", "NOTE"])
    expect(followUpOffsets()).toEqual([1, 3, 7])
  })

  it("cold lead (score < 40) gets the [3,7,14] day cadence", async () => {
    // NOBROKER + COLD, no config/budget → 38 → cold band.
    await enqueueLead("w1", "nobroker", {
      lead_id: "nb-1",
      name: "Cold Caller",
      phone: "+919800000001",
      intent: "COLD",
    })
    await processBatch("w1")
    const rows = followUpRows()
    expect(rows).toHaveLength(3)
    expect(followUpOffsets()).toEqual([3, 7, 14])
  })
})

describe("queue stats", () => {
  it("tracks pending and processed counts across enqueue and processBatch", async () => {
    for (let i = 0; i < 5; i++) {
      await enqueueLead("w1", "ninety_nine_acres", { ...LEAD, lead_id: `99-${i}` }, true)
    }
    let stats = await getQueueStats("w1")
    expect(stats.pending).toBe(5)
    expect(stats.processed).toBe(0)
    expect(stats.failed).toBe(0)
    expect(stats.oldestPendingAt).toBeInstanceOf(Date)

    const result = await processBatch("w1", 3)
    expect(result).toEqual({ processed: 3, failed: 0 })

    stats = await getQueueStats("w1")
    expect(stats.pending).toBe(2)
    expect(stats.processed).toBe(3)
    expect(stats.oldestPendingAt).toBeInstanceOf(Date)
  })
})
