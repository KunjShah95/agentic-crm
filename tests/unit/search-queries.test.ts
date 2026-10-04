import { describe, it, expect, vi, beforeEach } from "vitest"

const db = vi.hoisted(() => ({
  $queryRaw: vi.fn().mockResolvedValue([{ id: "c1", name: "Hemal Shah", subtitle: "hemal@shilp.co.in" }]),
}))
vi.mock("@/lib/db", () => ({ db }))

import { searchWorkspace } from "@/modules/search/queries"
import type { Role } from "@/lib/generated/prisma/client"
import type { ViewerScope } from "@/lib/permissions"

const scope = (role: Role = "OWNER", brokerId: string | null = null): ViewerScope => ({
  workspaceId: "w1",
  role,
  brokerId,
})

/**
 * Flatten a tagged-template `$queryRaw` call into SQL text plus bound values.
 *
 * Needed because the broker predicate is the one filter in this codebase written
 * as raw SQL — it is interpolated as a `Prisma.sql` fragment, so it never appears
 * in the outer template's static chunks. A test that joined only those chunks
 * would report the query as unscoped while it was in fact scoped, which is the
 * more dangerous direction to be wrong in.
 */
function flatten(call: unknown[]): { text: string; values: unknown[] } {
  const chunks = call[0] as string[]
  let text = ""
  const values: unknown[] = []
  // Walk the outer template's chunks and values in lockstep.
  for (let i = 0; i < chunks.length; i++) {
    text += chunks[i]
    if (i >= call.length - 1) break
    const value = call[i + 1]
    if (isSql(value)) {
      const inner = flatten([value.strings, ...value.values])
      text += inner.text
      values.push(...inner.values)
    } else {
      text += " ?"
      values.push(value)
    }
  }
  return { text, values }
}

function isSql(v: unknown): v is { strings: string[]; values: unknown[] } {
  return (
    typeof v === "object" &&
    v !== null &&
    Array.isArray((v as { strings?: unknown }).strings) &&
    Array.isArray((v as { values?: unknown }).values)
  )
}

const sqlOf = (i: number) => flatten(db.$queryRaw.mock.calls[i] as unknown[])

// Essential, not hygiene: the broker-scoping cases below assert on positional
// `mock.calls[0..2]`, and without a reset those indexes resolve to calls left
// over from the earlier OWNER-scope cases. The assertion then inspects an
// unscoped query and reports the feature as broken when it is working — or,
// worse, passes while reading an unscoped query.
beforeEach(() => {
  vi.clearAllMocks()
  db.$queryRaw.mockResolvedValue([])
})

describe("searchWorkspace", () => {
  it("returns [] for empty/whitespace queries without querying", async () => {
    expect(await searchWorkspace(scope(), "")).toEqual([])
    expect(await searchWorkspace(scope(), "   ")).toEqual([])
    expect(db.$queryRaw).not.toHaveBeenCalled()
  })

  it("queries contacts, orgs, and deals in parallel and maps hits", async () => {
    db.$queryRaw
      .mockResolvedValueOnce([{ id: "c1", name: "Hemal Shah", subtitle: "hemal@shilp.co.in" }])
      .mockResolvedValueOnce([{ id: "o1", name: "Shilp Infra", subtitle: "shilp.co.in" }])
      .mockResolvedValueOnce([{ id: "d1", name: "Shilp Heights 3BHK", subtitle: "INR" }])

    const hits = await searchWorkspace(scope(), "hemal")

    expect(db.$queryRaw).toHaveBeenCalledTimes(3)
    expect(hits).toMatchObject([
      { type: "contact", id: "c1", name: "Hemal Shah" },
      { type: "organization", id: "o1", name: "Shilp Infra" },
      { type: "deal", id: "d1", name: "Shilp Heights 3BHK" },
    ])
  })

  it("does not reference the dropped searchVector column", async () => {
    db.$queryRaw.mockResolvedValue([])
    await searchWorkspace(scope(), "test")

    for (const call of db.$queryRaw.mock.calls) {
      // Tagged-template: chunks are split around ${} placeholders — join them
      const sql = (call[0] as unknown as string[]).join(" ? ")
      expect(sql).not.toContain("searchVector")
    }
  })

  it("uses prefix_tsquery, not plainto_tsquery", async () => {
    db.$queryRaw.mockResolvedValue([])
    await searchWorkspace(scope(), "test")

    for (const call of db.$queryRaw.mock.calls) {
      const sql = (call[0] as unknown as string[]).join(" ? ")
      // Prefix matching is the point: plainto_tsquery matches whole lexemes
      // only, so "anj" returned nothing while "anjali" worked, which is
      // indistinguishable from a broken search box.
      expect(sql).toContain(" prefix_tsquery")
      expect(sql).not.toContain("plainto_tsquery")
    }
  })

  it("includes phone in the contact search vector", async () => {
    db.$queryRaw.mockResolvedValue([])
    await searchWorkspace(scope(), "98250")

    // A sales team looks people up by the number that called, not by name.
    // Phone was absent from contact_search_tsv entirely until migration
    // 20261003120000_search_phone_prefix.
    //
    // Join the chunks: it is a tagged template, so `"phone"` lands in a chunk
    // after the ${workspaceId} interpolation rather than in chunks[0].
    const chunks = db.$queryRaw.mock.calls[0][0] as unknown as string[]
    expect(chunks.join(" ? ")).toContain('"phone"')
  })

  it("scopes every query to the workspaceId", async () => {
    db.$queryRaw.mockResolvedValue([])
    await searchWorkspace({ workspaceId: "w-abc", role: "OWNER", brokerId: null }, "test")

    for (const call of db.$queryRaw.mock.calls) {
      const sql = (call[0] as unknown as string[]).join(" ? ")
      expect(sql).toContain(`"workspaceId" = `)
    }
  })
})

describe("searchWorkspace broker scoping (raw SQL)", () => {
  it("restricts contacts to those on one of the broker's deals", async () => {
    db.$queryRaw.mockResolvedValue([])
    await searchWorkspace(scope("BROKER", "cp-1"), "hemal")

    const contact = sqlOf(0)
    // Equivalent to brokerContactScope's `deals: { some: { brokerId } }`.
    expect(contact.text).toContain("EXISTS")
    expect(contact.text).toContain('b."contactId" = "Contact"."id"')
    expect(contact.text).toContain('b."brokerId" = ')
    expect(contact.values).toContain("cp-1")
  })

  it("restricts deals to the broker's own", async () => {
    db.$queryRaw.mockResolvedValue([])
    await searchWorkspace(scope("BROKER", "cp-1"), "hemal")

    const deal = sqlOf(2)
    expect(deal.text).toContain('"Deal"')
    expect(deal.text).toContain('AND "brokerId" = ')
    expect(deal.values).toContain("cp-1")
  })

  it("leaves organizations unscoped, since Organization has no broker dimension", async () => {
    db.$queryRaw.mockResolvedValue([])
    await searchWorkspace(scope("BROKER", "cp-1"), "hemal")

    // Deliberate: an organization is shared master data, like a Project. Hiding
    // one from a broker because a colleague's deal references it would break the
    // linking workflow. Only the row name/domain is returned — no contact or
    // deal rows are expanded from it here.
    const org = sqlOf(1)
    expect(org.text).not.toContain("brokerId")
    expect(org.values).not.toContain("cp-1")
  })

  it("a BROKER with no linked broker record matches nothing", async () => {
    db.$queryRaw.mockResolvedValue([])
    await searchWorkspace(scope("BROKER", null), "hemal")

    // Must mirror the __no_broker__ sentinel the Prisma paths use, otherwise a
    // broker whose Broker row was deleted sees the whole tenant.
    expect(sqlOf(0).values).toContain("__no_broker__")
    expect(sqlOf(2).values).toContain("__no_broker__")
  })

  it("emits no broker predicate at all for a non-BROKER role", async () => {
    db.$queryRaw.mockResolvedValue([])
    await searchWorkspace(scope("OWNER", "cp-1"), "hemal")

    // Passing a brokerId for a non-BROKER must not filter them: OWNER/ADMIN see
    // the whole workspace by design, and a stray predicate here would silently
    // hide records from an admin.
    for (const i of [0, 1, 2]) {
      expect(sqlOf(i).text).not.toContain("brokerId")
      expect(sqlOf(i).values).not.toContain("cp-1")
    }
  })

  it("binds every value as a parameter rather than interpolating it", async () => {
    db.$queryRaw.mockResolvedValue([])
    await searchWorkspace(scope("BROKER", "cp-1"), "hemal")

    // The broker id arrives as a bound parameter, so a hostile value cannot
    // escape the predicate. If this ever inlines instead, the static chunks
    // would contain cp-1 and the values array would not.
    for (const i of [0, 2]) {
      const raw = (db.$queryRaw.mock.calls[i][0] as unknown as string[]).join(" ? ")
      expect(raw).not.toContain("cp-1")
    }
  })
})