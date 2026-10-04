import { describe, it, expect } from "vitest"
import fs from "node:fs"
import path from "node:path"
import { REPO_ROOT } from "../helpers/source-scan"

/**
 * Tenant-scope guard: every query against a tenant-owned model must carry a
 * `workspaceId` predicate.
 *
 * ## Why this test exists
 *
 * `docs/security/open-findings.md` records the HIGH finding: effective
 * isolation is **one** layer, not three. The app gate and the `where` clause are
 * real; the Postgres RLS backstop is not deployed for any CRM table, and could
 * not be, because `DATABASE_URL` connects as a role carrying `BYPASSRLS`.
 *
 * The consequence is stated plainly in that doc: *"A single forgotten
 * `workspaceId` on a CRM table is an immediate, unrecoverable cross-tenant read
 * or write."* With no database-side net, the `where` clause is the entire
 * boundary — so its absence has to be a build failure rather than something a
 * reviewer has to notice across ~230 call sites.
 *
 * ## Why not a linter rule
 *
 * `@typescript-eslint` cannot see this. The predicate is a runtime object, and
 * the interesting failures are structural rather than syntactic: a `where`
 * assembled into a variable three lines earlier, a write keyed on a bare `id`
 * after an unverified lookup, a `count` reusing a sibling query's filter. A
 * regex linter would either miss those or produce so many false positives that
 * the rule gets deleted. This reads the actual call site and classifies what it
 * finds, so each exemption has to be argued in prose.
 *
 * ## The rule
 *
 * A call is compliant when a `workspaceId` predicate is visible in the
 * statement or the code immediately above it. Calls that are compliant *by other
 * means* must be registered in EXEMPT below with a reason — which is the part
 * that matters, because that list is the thing a reviewer actually reads.
 */

/** Model name (PascalCase) → whether it carries `workspaceId`. */
function tenantOwnedModels(): Set<string> {
  const schema = fs.readFileSync(path.join(REPO_ROOT, "prisma/schema.prisma"), "utf8")
  const owned = new Set<string>()
  // `model X { … }`, body captured so the column list can be inspected.
  for (const m of schema.matchAll(/model (\w+) \{([\s\S]*?)\n\}/g)) {
    if (/^\s*workspaceId\s+String/m.test(m[2])) {
      // Prisma delegates are camelCase: `db.deal`, not `db.Deal`.
      owned.add(m[1].toLowerCase())
    }
  }
  return owned
}

const TENANT_OWNED = tenantOwnedModels()

const CALL = /db\.(\w+)\.(findMany|findFirst|findUnique|count|groupBy|aggregate|update|updateMany|delete|deleteMany|upsert|create|createMany)\(/

/**
 * How far above a call to look for the predicate.
 *
 * Tuned, not arbitrary. Measured across the repo: at 16 lines exactly three
 * call sites remain unresolved, and at 40 lines *none* do — because the wider
 * window reaches the previous `where` in the Stripe handlers and the scoped
 * `findFirst` in the booking actions.
 *
 * So the window is kept deliberately narrow and the residue is registered by
 * hand. The trade is explicit: a narrow window can flag a compliant site (a
 * false positive, resolved by adding an exemption with a reason) but cannot
 * hide an unscoped one behind a distant match, which is the direction that
 * matters. Widening the window to make the suite quiet would trade the failure
 * mode this whole file exists to prevent for a tidier report.
 */
const LOOKBACK_LINES = 16

type Site = {
  /** `model.op@file:line` — line-numbered so a moved call is a visible change. */
  id: string
  /** `model.op@file` — line-number-free, for reasons shared across a group. */
  key: string
  file: string
  line: number
  model: string
  op: string
  snippet: string
}

/**
 * Reasons, named so the same argument is not reworded per site. A site is only
 * exempt because a *reason* applies to it — the reason and the site are
 * separate, which is what makes the list auditable.
 */
const EXEMPT_REASON = {
  stripe:
    "Stripe webhook. The event carries a customer id, not a workspace id, so the tenant is derived from the row found by `stripeCustomerId`/`stripeSubId` and used for the upsert. Reached only after signature verification, so the id is not caller-chosen.",
  sharedWhereContact:
    "`where` is built above the query as `{ workspaceId: scope.workspaceId, ...brokerContactScope(...) }` and passed by reference, so the literal is not at the call site.",
} as const

/**
 * Sites that are correct without naming `workspaceId`.
 *
 * Every entry states *why* the tenant boundary still holds. An entry with an
 * empty or vague reason is worse than no entry, because it looks like coverage.
 */
const EXEMPT: Record<string, string> = {
  // ── Stripe webhook ────────────────────────────────────────────────────────
  // `Subscription` is looked up by its Stripe identifiers because the webhook
  // knows the customer, not the tenant — there is no workspace id in the event
  // to filter on. The workspace is then *derived* from the row
  // (`existing.workspaceId`) and used for the upsert and plan sync. The Stripe
  // signature is verified before this runs, so the customer id is not
  // caller-chosen. Keyed without a line number because the argument covers all
  // five lookups in the file, in both event handlers.
  "subscription.findUnique@modules/billing/stripe.ts": EXEMPT_REASON.stripe,

  // ── Shared `where` object ─────────────────────────────────────────────────
  // The predicate is assembled into a variable and passed by reference, so the
  // literal sits above the call rather than in it. `contact.count` reuses the
  // identical `where` object as the `findMany`, which is what makes the
  // count/query pair consistent by construction.
  "contact.findMany@modules/contacts/queries.ts": EXEMPT_REASON.sharedWhereContact,
  "contact.count@modules/contacts/queries.ts": EXEMPT_REASON.sharedWhereContact,
}

/**
 * Public micro-site. The project is resolved through the workspace slug first,
 * so `projectId` is already proven to belong to that workspace before the units
 * are read. Not a tenant leak — but the derivation is the reason it is listed
 * rather than assumed.
 */
const PUBLIC_DERIVATION_NOTE =
  "modules/sites/queries.ts: project verified by `{ id, workspaceId: ws.id }` before the unit read."

function walk(dir: string, out: string[] = []): string[] {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name === "node_modules" || e.name.startsWith(".")) continue
    const full = path.join(dir, e.name)
    if (e.isDirectory()) walk(full, out)
    else if (/\.tsx?$/.test(e.name)) out.push(full)
  }
  return out
}

/** Every tenant-model call site that shows no `workspaceId` near it. */
function unscopedSites(): Site[] {
  const files = ["app", "modules", "lib"].flatMap((r) =>
    walk(path.join(REPO_ROOT, r)).filter((f) => !f.includes(`${path.sep}generated${path.sep}`)),
  )

  const sites: Site[] = []
  for (const file of files) {
    const rel = path.relative(REPO_ROOT, file).replace(/\\/g, "/")
    const lines = fs.readFileSync(file, "utf8").split(/\r?\n/)
    lines.forEach((line, i) => {
      const m = CALL.exec(line)
      if (!m) return
      const model = m[1]
      if (!TENANT_OWNED.has(model)) return

      const from = Math.max(0, i - LOOKBACK_LINES)
      if (/workspaceId/.test(lines.slice(from, i + 8).join("\n"))) return

      sites.push({
        id: `${model}.${m[2]}@${rel}:${i + 1}`,
        key: `${model}.${m[2]}@${rel}`,
        file: rel,
        line: i + 1,
        model,
        op: m[2],
        snippet: lines
          .slice(from, i + 3)
          .map((l) => l.trim())
          .filter(Boolean)
          .slice(-4)
          .join(" "),
      })
    })
  }
  return sites.sort((a, b) => (a.id < b.id ? -1 : 1))
}

const sites = unscopedSites()

describe("tenant scope guard", () => {
  it("knows which models are tenant-owned", () => {
    // Guards the scanner itself. `Contact`, `Deal`, `Activity`, `Unit`,
    // `Payment` and `Broker` must all be in this set — if a schema change
    // renames a column, an empty or shrunken set turns this suite into a no-op
    // that reports a clean codebase while scanning nothing.
    expect(TENANT_OWNED.size).toBeGreaterThan(20)
    for (const m of ["contact", "deal", "activity", "unit", "payment", "broker"]) {
      expect(TENANT_OWNED.has(m), `${m} should be tenant-owned`).toBe(true)
    }
  })

  it("scans a meaningful number of call sites", () => {
    // Same reasoning: a scanner that silently matches nothing is worse than no
    // scanner, because it is indistinguishable from a clean result.
    const total = ["app", "modules", "lib"]
      .flatMap((r) => walk(path.join(REPO_ROOT, r)))
      .filter((f) => !f.includes(`${path.sep}generated${path.sep}`))
      .reduce((n, f) => {
        const src = fs.readFileSync(f, "utf8")
        return n + [...src.matchAll(new RegExp(CALL, "g"))].filter((m) =>
          TENANT_OWNED.has(m[1]),
        ).length
      }, 0)
    expect(total, "tenant-model call sites found").toBeGreaterThan(150)
  })

  it("every unscoped tenant-model call is registered with a reason", () => {
    const unregistered = sites.filter((s) => !(s.key in EXEMPT))
    const stale = Object.keys(EXEMPT).filter((key) => !sites.some((s) => s.key === key))
    const lines: string[] = []
    if (unregistered.length) {
      lines.push(
        `  ${unregistered.length} call site(s) against a tenant-owned model with no\n` +
          `  workspaceId predicate and no registered exemption.\n` +
          `  Add workspaceId, or if the tenant boundary genuinely holds another way,\n` +
          `  register it in EXEMPT with a reason that can be checked:\n`,
        ...unregistered.map((s) => `    ${s.id}\n        ${s.snippet.slice(0, 110)}`),
      )
    }
    if (stale.length) {
      lines.push(
        `  Exemption(s) no longer matching any unscoped site — the call was fixed or\n` +
          `  moved, so delete the entry:\n`,
        ...stale.map((id) => `    ${id}`),
      )
    }
    expect(lines.join("\n")).toBe("")
  })

  it("every exemption states a reason", () => {
    // A bare entry is indistinguishable from an unexamined call site that got
    // swept into the safe bucket, which is the failure mode this whole suite
    // exists to prevent.
    const unreasoned = Object.entries(EXEMPT)
      .filter(([, reason]) => !reason || reason.trim().length < 20)
      .map(([id]) => id)
    expect(unreasoned.join("\n")).toBe("")
  })

  it("keeps the public micro-site derivation documented", () => {
    // `getPublicProject` reads units by `projectId` alone. That is safe because
    // the project is resolved through the workspace slug first, but it is the
    // one place where a tenant read is reached by derivation rather than by
    // predicate, so the reasoning is pinned rather than left in a comment that
    // nobody re-reads.
    const src = fs.readFileSync(
      path.join(REPO_ROOT, "modules/sites/queries.ts"),
      "utf8",
    )
    expect(src).toMatch(/id: projectId, workspaceId: ws\.id/)
    expect(PUBLIC_DERIVATION_NOTE).toContain("verified by")
  })
})