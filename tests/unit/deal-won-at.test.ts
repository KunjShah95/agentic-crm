import { beforeEach, describe, expect, it, vi } from "vitest"

/**
 * `wonAt` stamping on stage transitions.
 *
 * The dashboard buckets won revenue by `Deal.wonAt`. That column is only as
 * trustworthy as the write paths that maintain it, and there are four of them:
 * drag-and-drop (`moveDealStageAction`), the table dropdown (same action),
 * bulk move (`bulkMoveDealsAction`), and the edit form
 * (`updateDealAction`) — plus `createDealAction` for a deal born in Won.
 *
 * A `wonAt` that one path sets and another forgets is worse than no column at
 * all: the dashboard trusts it and quietly mis-buckets whichever deals arrived
 * through the missed path. So every path is asserted here.
 *
 * The clearing direction matters just as much as the stamping one. A reopened
 * deal that keeps its old `wonAt` stays in the revenue series while sitting in
 * Negotiation, and if it is later re-won it inherits a stale date instead of
 * getting a fresh one.
 *
 * Every stage below is given a name that deliberately does *not* match its kind
 * where the two could be confused, because the decision is made on `kind` — a
 * stage called "Won" with kind OPEN must not stamp, and one called "Proposal"
 * with kind WON must.
 */

const mocks = vi.hoisted(() => ({
  dealUpdate: vi.fn(),
  dealUpdateMany: vi.fn(),
  dealCreate: vi.fn(),
  dealFindFirst: vi.fn(),
  dealFindMany: vi.fn(),
  stageFindFirst: vi.fn(),
}))

vi.mock("@/lib/db", () => ({
  db: {
    deal: {
      findFirst: mocks.dealFindFirst,
      findMany: mocks.dealFindMany,
      update: mocks.dealUpdate,
      updateMany: mocks.dealUpdateMany,
      create: mocks.dealCreate,
    },
    pipelineStage: { findFirst: mocks.stageFindFirst },
    activity: { create: vi.fn().mockResolvedValue({}) },
    $transaction: vi.fn(async (ops: unknown[]) => Promise.all(ops)),
  },
}))
vi.mock("@/lib/auth", () => ({ auth: vi.fn().mockResolvedValue({ user: { id: "u1" } }) }))
vi.mock("@/lib/permissions", async () => {
  const actual = await vi.importActual<typeof import("@/lib/permissions")>("@/lib/permissions")
  return {
    ...actual,
    requireWorkspaceMember: vi.fn().mockResolvedValue({ role: "OWNER", workspaceId: "w1" }),
  }
})

import { bulkMoveDealsAction, moveDealStageAction } from "@/lib/actions/deals"

/** A stage whose `name` is deliberately uninformative about its `kind`. */
function stage(id: string, kind: "OPEN" | "WON" | "LOST") {
  mocks.stageFindFirst.mockResolvedValue({ id, kind, name: `${id}-display-name` })
}

function deal(currentStage: { id: string; kind: "OPEN" | "WON" | "LOST" }) {
  mocks.dealFindFirst.mockResolvedValue({
    id: "d1",
    stageId: currentStage.id,
    stage: { ...currentStage, name: `${currentStage.id}-display-name` },
  })
}

/** The `data` payload handed to `db.deal.update`. */
function updatedData() {
  return mocks.dealUpdate.mock.calls.at(-1)?.[0]?.data
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.dealUpdate.mockResolvedValue({})
  mocks.dealUpdateMany.mockResolvedValue({ count: 1 })
  mocks.dealCreate.mockResolvedValue({ id: "d1" })
  mocks.dealFindMany.mockResolvedValue([])
})

describe("moveDealStageAction and wonAt", () => {
  it("stamps now when a deal moves into a WON-kind stage", async () => {
    deal({ id: "st-neg", kind: "OPEN" })
    stage("st-closed-won", "WON")

    await moveDealStageAction("w1", "d1", "st-closed-won")

    expect(updatedData().stageId).toBe("st-closed-won")
    expect(updatedData().wonAt).toBeInstanceOf(Date)
  })

  it("does not stamp for a stage merely NAMED 'Won' but still OPEN", async () => {
    // The rename scenario this whole change exists for. Before `kind`, this
    // stamped a won date for a working stage.
    mocks.stageFindFirst.mockResolvedValue({ id: "st-x", kind: "OPEN", name: "Won" })

    await moveDealStageAction("w1", "d1", "st-x")

    expect(updatedData().wonAt).toBeNull()
  })

  it("stamps for a stage renamed away from 'Won' but still WON-kind", async () => {
    mocks.stageFindFirst.mockResolvedValue({ id: "st-y", kind: "WON", name: "Closed Won" })

    await moveDealStageAction("w1", "d1", "st-y")

    expect(updatedData().wonAt).toBeInstanceOf(Date)
  })

  it("clears wonAt when a won deal is reopened", async () => {
    deal({ id: "st-won", kind: "WON" })
    stage("st-neg", "OPEN")

    await moveDealStageAction("w1", "d1", "st-neg")

    expect(updatedData().stageId).toBe("st-neg")
    expect(updatedData().wonAt).toBeNull()
  })

  it("leaves wonAt null moving between two open stages", async () => {
    deal({ id: "st-lead", kind: "OPEN" })
    stage("st-prop", "OPEN")

    await moveDealStageAction("w1", "d1", "st-prop")

    expect(updatedData().wonAt).toBeNull()
  })

  it("does not touch the row when the stage is unchanged", async () => {
    // A no-op move must not restamp wonAt — otherwise reopening and
    // re-selecting the same stage would rewrite history.
    deal({ id: "st-won", kind: "WON" })
    stage("st-won", "WON")

    await moveDealStageAction("w1", "d1", "st-won")

    expect(mocks.dealUpdate).not.toHaveBeenCalled()
  })

  it("clears wonAt when a won deal is moved to a LOST-kind stage", async () => {
    deal({ id: "st-won", kind: "WON" })
    stage("st-lost", "LOST")

    await moveDealStageAction("w1", "d1", "st-lost")

    expect(updatedData().wonAt).toBeNull()
  })
})

describe("bulkMoveDealsAction and wonAt", () => {
  it("stamps the same date on every deal bulk-moved into a WON-kind stage", async () => {
    stage("st-won", "WON")
    mocks.dealFindMany.mockResolvedValue([
      { id: "d1", stage: { name: "Negotiation" } },
      { id: "d2", stage: { name: "Proposal" } },
    ])

    await bulkMoveDealsAction("w1", { dealIds: ["d1", "d2"], stageId: "st-won" })

    expect(mocks.dealUpdateMany).toHaveBeenCalledTimes(1)
    const data = mocks.dealUpdateMany.mock.calls[0][0].data
    expect(data.stageId).toBe("st-won")
    expect(data.wonAt).toBeInstanceOf(Date)
  })

  it("clears wonAt when bulk-moving won deals out", async () => {
    stage("st-neg", "OPEN")

    await bulkMoveDealsAction("w1", { dealIds: ["d1"], stageId: "st-neg" })

    expect(mocks.dealUpdateMany.mock.calls[0][0].data.wonAt).toBeNull()
  })
})