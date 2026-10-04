import { describe, it, expect } from "vitest"
import fs from "node:fs"
import path from "node:path"
import { REPO_ROOT } from "../helpers/source-scan"

/**
 * Broker-visibility registry for tenant read paths.
 *
 * `docs/security/open-findings.md` recorded the core defect this file exists to
 * make structurally unrepeatable:
 *
 * > `lib/permissions.ts:73` documents BROKER-role users as seeing only their
 * > allocated inventory and deals. Applied in `modules/brokers/queries.ts`,
 * > `modules/booking/queries.ts`, `modules/reports/queries.ts`. Not applied —
 * > these functions take no `role` parameter at all.
 *
 * The seven named functions were unscoped for the same reason in every case:
 * the signature carried only `workspaceId`, so `brokerScopeFilter` had no role
 * to act on and the query was workspace-wide by construction. The fix is not
 * "remember to scope" — it is to make the unscoped signature unrepresentable
 * (every tenant read now takes a `ViewerScope`) and to fail when a *new* read
 * path appears without a recorded visibility decision.
 *
 * ── How to read a failure ───────────────────────────────────────────────────
 * `unregistered` means a new query function was added and nobody decided whether
 * a broker may see its rows. Add it to REGISTRY with the right state. That is a
 * five-second decision, and it is the decision that was previously being made
 * silently, wrongly, by omission.
 *
 * `state: "scoped"` but no filter call found means the registry claims scoping
 * that the code does not do. Treat that as a live leak, not a stale entry.
 *
 * ── Why "unreviewed" is tracked with a baseline ─────────────────────────────
 * Listing the remaining surface honestly is more useful than quietly marking it
 * safe. `UNREVIEWED_BASELINE` ratchets: the count may only fall, so the gap
 * cannot widen, and the outstanding list is printed on every run.
 */

type State =
  /** Broker-filtered. The test asserts the filter call is actually present. */
  | "scoped"
  /** Deliberately workspace-wide; `reason` must say why that is correct. */
  | "workspace-wide"
  /** Not yet examined. Counted and printed; fails only if the count grows. */
  | "unreviewed"

type Entry = { state: State; reason: string }

const REGISTRY: Record<string, Entry> = {
  // ── Broker-scoped: verified to call a filter helper ───────────────────────
  "booking/queries::listBookings": {
    state: "scoped",
    reason: "Broker sees only their allocated booking-pipeline deals.",
  },
  "brokers/queries::listVisibleUnits": {
    state: "scoped",
    reason: "Units reached through deals carrying the brokerId.",
  },
  "brokers/queries::listVisibleDeals": { state: "scoped", reason: "Named for it." },
  "brokers/queries::listCommissions": {
    state: "scoped",
    reason: "A broker sees only their own commission ledger.",
  },
  "contacts/queries::listContacts": {
    state: "scoped",
    reason: "Contact has no brokerId; brokerContactScope reaches it via deals.",
  },
  "contacts/queries::getContactDetail": {
    state: "scoped",
    reason: "Parent row and the nested deals relation are both filtered.",
  },
  "deals/queries::getPipeline": {
    state: "scoped",
    reason: "Kanban board is the broker's primary view of their book.",
  },
  "deals/queries::listDealsForTable": {
    state: "scoped",
    reason: "Same rows as the kanban, table rendering.",
  },
  "deals/queries::getDealDetail": {
    state: "scoped",
    reason: "Predicate is in the lookup, so a foreign deal reads as not-found.",
  },
  "deals/queries::pipelineStats": {
    state: "scoped",
    reason: "Counts and pipeline value are rollups over deal rows.",
  },
  "dashboard/queries::getDashboardData": {
    state: "scoped",
    reason: "Every deal- and contact-derived figure is a rollup over rows.",
  },
  "reports/queries::getFunnel": { state: "scoped", reason: "Rollup over deal rows." },
  "reports/queries::getCollections": {
    state: "scoped",
    reason: "Payments are reached through their deal, so scoped on the relation.",
  },
  "reports/queries::getSourceROI": { state: "scoped", reason: "Rollup over deal rows." },

  // ── Workspace-wide by design ─────────────────────────────────────────────
  "contacts/queries::listWorkspaceMembers": {
    state: "workspace-wide",
    reason: "Team directory. A broker must see who else is in the workspace to assign work.",
  },
  "contacts/queries::findContactByHandle": {
    state: "workspace-wide",
    reason: "Identity resolution for inbound social/webhook ingest. Server-side, not a broker-facing list, and the caller is an authenticated provider path.",
  },
  "brokers/queries::listBrokers": {
    state: "workspace-wide",
    reason: "Admin channel-partner directory on a page that is ADMIN-gated.",
  },
  "brokers/queries::resolveBrokerId": {
    state: "workspace-wide",
    reason: "Infra: resolves the caller's own broker row, keyed by their userId.",
  },
  "property/queries::listProjects": {
    state: "workspace-wide",
    reason: "Project catalogue, not broker-allocated. Same reasoning as reports/queries::getInventoryHealth.",
  },
  "property/queries::listUnits": {
    state: "workspace-wide",
    reason: "Inventory is not broker-scoped in this schema — Unit has no brokerId; allocation is expressed through Deal.brokerId.",
  },
  "booking/queries::listBookableUnits": {
    state: "workspace-wide",
    reason: "Unit picker for the booking wizard; units are not broker-scoped.",
  },
  "booking/queries::listPaymentPlans": {
    state: "workspace-wide",
    reason: "Payment plans hang off Project, which is not broker-scoped.",
  },
  "sites/queries::getPublicProject": {
    state: "workspace-wide",
    reason: "Public micro-site. Unauthenticated by design, and already subject to its own exposure rules.",
  },

  // ── Workspace-wide: shared master data with no broker dimension ───────────
  "organizations/queries::listOrganizations": {
    state: "workspace-wide",
    reason: "An organization is a counterparty shared by every broker and exists independently of any deal. Hiding one because a colleague's deal references it would break the linking workflow. Returns a _count of contacts and deals, not the rows.",
  },
  "documents/queries::listTemplates": {
    state: "workspace-wide",
    reason: "DocumentTemplate is workspace configuration — the RERA-aligned template set the whole office picks from. No per-broker variant exists.",
  },
  "reports/queries::getInventoryHealth": {
    state: "workspace-wide",
    reason: "Unit has no brokerId, so allocation cannot be expressed here. Filtering would silently redefine the metric as 'units on my deals'. Deal-derived reports are scoped instead.",
  },

  // ── Workspace-wide: the association IS the sharing boundary ───────────────
  // These are keyed by associationId, not workspaceId. A pooled lead is
  // deliberately visible to every member of the association, including members
  // of *other* workspaces — that is the product feature (a NAAR broker network
  // pooling inventory). The workspace boundary is enforced upstream by
  // getAssociationForWorkspace, which resolves the caller's own membership
  // before any associationId is accepted.
  "association/queries::getAssociationForWorkspace": {
    state: "workspace-wide",
    reason: "Resolves the association via the caller's own membership row; this is the workspace boundary for the three queries below it.",
  },
  "association/queries::listPooledLeads": {
    state: "workspace-wide",
    reason: "Cross-workspace pooling is the association's purpose. Gated by getAssociationForWorkspace upstream.",
  },
  "association/queries::listReferrals": {
    state: "workspace-wide",
    reason: "Same association-scoped sharing as pooled leads; a referral necessarily names both workspaces.",
  },
  "association/queries::listAssociationMembers": {
    state: "workspace-wide",
    reason: "Roster of the association, which spans workspaces by design.",
  },

  // ── Workspace-wide: known gap, structurally blocked ───────────────────────
  "documents/queries::listGeneratedDocuments": {
    state: "workspace-wide",
    reason: "GAP. renderedHtml is a full deal document (buyer, unit, payment figures) and would be broker-scoped, but GeneratedDocument.dealId is a bare column with no @relation to Deal, so there is nothing to filter through. Closing it needs either a relation added to the schema or a denormalised brokerId column — both migrations. Tracked in docs/security/open-findings.md.",
  },

  // ── Broker-scoped ─────────────────────────────────────────────────────────
  "reports/queries::getTeamVsTarget": {
    state: "scoped",
    reason: "Booking counts are a rollup over deal rows and are filtered. The member directory stays workspace-wide so a broker can see who to hand a lead to.",
  },
  "reports/queries::getPipelineByStage": {
    state: "scoped",
    reason: "Per-stage count and value is a rollup over deal rows.",
  },
  "reports/queries::getDealsByOwner": {
    state: "scoped",
    reason: "Per-owner count and value is a rollup over deal rows.",
  },
  "reports/queries::getWinRateByDealType": {
    state: "scoped",
    reason: "Win rate is a ratio over deal rows; an unscoped denominator would compare a broker against the whole tenant.",
  },
  "search/queries::searchWorkspace": {
    state: "scoped",
    reason: "The ⌘K palette is the widest read surface in the product. Broker predicate is hand-written SQL — the only such filter in the codebase — and asserted behaviourally in search-queries.test.ts.",
  },
  "siteVisits/queries::listSiteVisits": {
    state: "scoped",
    reason: "Rows carry lead name, phone, free-text notes and a GPS fix. Scoped through the visit's deal; deal-less visits stay visible.",
  },
  "whatsapp/queries::listInboxContacts": {
    state: "scoped",
    reason: "Every conversation in the tenant, with phone numbers and the optedOut DPDP consent flag.",
  },
  "whatsapp/queries::listInboxContactsByChannel": {
    state: "scoped",
    reason: "Same row set as listInboxContacts, filtered by channel.",
  },
  "whatsapp/queries::getContactTimeline": {
    state: "scoped",
    reason: "Full message bodies for one contact. Gated on a scoped contact lookup so a foreign id renders empty rather than another broker's conversation.",
  },
  "whatsapp/queries::getReplyContext": {
    state: "scoped",
    reason: "Phone, opt-out state and the 24h reply-window clock. The window lookup is skipped when the contact is not visible, so it cannot be used to probe foreign ids.",
  },
  "organizations/queries::getOrganizationDetail": {
    state: "scoped",
    reason: "The org row is shared but the nested contacts and deals are not — both relations are filtered, otherwise this page was a directory of every contact and deal on any company looked up.",
  },
  "organizations/queries::getLinkableContacts": {
    state: "scoped",
    reason: "Auto-link suggestion list of contacts matched by email domain.",
  },
}

/*
 * `reports/queries::getReportsSnapshot` is deliberately absent.
 *
 * It is a pure composition — no `db.` of its own — so it inherits visibility
 * from the eight functions it calls rather than declaring any. It used to
 * forward `role`/`brokerId` to five of those eight and pass the workspace id
 * alone to the other three, which is how a broker ended up with a scoped funnel
 * beside an unscoped pipeline-by-stage on one screen. All eight now receive the
 * same `ViewerScope`, so the unevenness cannot recur.
 */

/**
 * The number of `unreviewed` entries allowed to remain. Lower it as entries are
 * triaged; the suite fails if the count goes *above* it, so the unexamined
 * surface can shrink but never silently grow.
 */
const UNREVIEWED_BASELINE = Object.values(REGISTRY).filter((e) => e.state === "unreviewed").length

const FILTER_CALLS = ["brokerScopeFilter", "brokerContactScope"]

/**
 * Every `queries.ts` that sits directly under a `modules/` subdirectory, keyed
 * as `<module>/queries`.
 *
 * Note the phrasing: naming the glob as `modules/**\//queries.ts` inside a block
 * comment silently ends the comment at the `*` + `/`, and every following line
 * is then parsed as code. That failure surfaces as an unrelated-looking parse
 * error dozens of lines later, which is why this comment avoids the pattern
 * rather than writing the path the obvious way.
 */
function queryFiles(): Array<{ key: string; file: string }> {
  const root = path.join(REPO_ROOT, "modules")
  return fs
    .readdirSync(root, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => path.join(root, e.name, "queries.ts"))
    .filter((abs) => fs.existsSync(abs))
    .map((abs) => ({
      key: `${path.basename(path.dirname(abs))}/queries`,
      file: abs,
    }))
}

/**
 * Extract every exported function and its body.
 *
 * Body extraction has to skip the parameter list, and the naive version of this
 * gets it wrong in a way that fails silently: `listBookings(ctx: { workspaceId:
 * string; role: Role })` opens a brace inside the *parameters*, so taking the
 * first `{` after the name yields the type annotation as the "body". That body
 * mentions no `db.`, so the function is classified as a pure helper and drops
 * out of the registry entirely — a scoped read path that the suite then reports
 * as an entry that no longer exists.
 *
 * So: match parentheses first to find where the signature ends, then take the
 * first brace after that. Braces are then counted to the matching close, which
 * also covers a query nested inside an `if` or a callback — a scanner that
 * truncates is a scanner that reports false confidence.
 */
function exportedFunctions(
  source: string,
): Array<{ name: string; body: string }> {
  const out: Array<{ name: string; body: string }> = []
  const decl = /export\s+(?:async\s+)?function\s+(\w+)\s*\(/g
  let m: RegExpExecArray | null
  while ((m = decl.exec(source)) !== null) {
    const openParen = m.index + m[0].length - 1
    let parens = 0
    let afterSig = openParen
    for (let i = openParen; i < source.length; i++) {
      if (source[i] === "(") parens++
      else if (source[i] === ")") {
        parens--
        if (parens === 0) {
          afterSig = i
          break
        }
      }
    }
    const open = source.indexOf("{", afterSig)
    if (open === -1) continue
    let depth = 0
    for (let i = open; i < source.length; i++) {
      if (source[i] === "{") depth++
      else if (source[i] === "}") {
        depth--
        if (depth === 0) {
          out.push({ name: m[1], body: source.slice(open, i + 1) })
          break
        }
      }
    }
  }
  return out
}

/** Query functions that actually touch the database. */
function tenantReads(): Array<{ id: string; name: string; body: string }> {
  const found: Array<{ id: string; name: string; body: string }> = []
  for (const { key, file } of queryFiles()) {
    const source = fs.readFileSync(file, "utf8")
    for (const fn of exportedFunctions(source)) {
      // `db.contact.findMany(` — the delegate access is two hops, so matching
      // `\bdb\.\w+\(` finds nothing and the scan silently reports zero reads.
      // `$` has to be in the class as well: Prisma's escape hatch is
      // `db.$queryRaw` / `db.$executeRaw`, and the raw-SQL read paths in
      // `modules/search` and `modules/rag` are exactly the ones most likely to
      // get a tenant predicate wrong.
      if (!/\bdb\.[$\w]+/.test(fn.body)) continue
      found.push({ id: `${key}::${fn.name}`, ...fn })
    }
  }
  return found.sort((a, b) => (a.id < b.id ? -1 : 1))
}

const reads = tenantReads()

describe("broker-visibility registry", () => {
  it("discovers tenant read paths to check", () => {
    // Guards the scanner itself. If this ever drops to a handful, the modules
    // tree has been restructured and the registry below is no longer covering
    // what it claims to cover — a silently-empty scan is worse than no scan.
    expect(reads.length).toBeGreaterThan(20)
  })

  it("every tenant read path has a recorded visibility decision", () => {
    const unregistered = reads
      .map((r) => r.id)
      .filter((id) => !(id in REGISTRY))
    const stale = Object.keys(REGISTRY).filter(
      (id) => !reads.some((r) => r.id === id),
    )
    const lines: string[] = []
    if (unregistered.length) {
      lines.push(
        `  Not registered — decide broker visibility for each, then add to REGISTRY:`,
        ...unregistered.map((id) => `    ${id}`),
      )
    }
    if (stale.length) {
      lines.push(
        `  Registered but no longer a tenant read (rename or delete the entry):`,
        ...stale.map((id) => `    ${id}`),
      )
    }
    expect(lines.join("\n")).toBe("")
  })

  it("entries claiming broker scoping actually call a filter helper", () => {
    const liars: string[] = []
    for (const read of reads) {
      const entry = REGISTRY[read.id]
      if (entry?.state !== "scoped") continue
      if (!FILTER_CALLS.some((fn) => read.body.includes(fn))) liars.push(read.id)
    }
    expect(
      liars.length
        ? `registry claims "scoped" but no filter call in the body:\n${liars
            .map((l) => `    ${l}`)
            .join("\n")}`
        : "",
    ).toBe("")
  })

  it("entries claiming to be workspace-wide say why", () => {
    // A bare "workspace-wide" with no reason is indistinguishable from an
    // unexamined function that got swept into the safe bucket.
    const unreasoned = Object.entries(REGISTRY)
      .filter(([, e]) => e.state === "workspace-wide" && !e.reason.trim())
      .map(([id]) => id)
    expect(unreviewedOr(unreasoned)).toBe("")
  })

  it("the unexamined surface does not grow", () => {
    const outstanding = reads
      .map((r) => r.id)
      .filter((id) => REGISTRY[id]?.state === "unreviewed")
    if (outstanding.length > UNREVIEWED_BASELINE) {
      throw new Error(
        `Unreviewed tenant reads rose from ${UNREVIEWED_BASELINE} to ${outstanding.length}.\n` +
          `Each new one is a read path with no recorded broker-visibility decision.\n` +
          `If the baseline was lowered, these were added after it:\n` +
          outstanding.map((id) => `    ${id}`).join("\n"),
      )
    }
    // Not an assertion: the list is the deliverable of this test. Run it to see
    // what is still unexamined.
    console.log(
      `\n  broker-visibility: ${reads.length} tenant reads, ` +
        `${outstanding.length} still unreviewed:\n` +
        outstanding.map((id) => `    ${id}`).join("\n"),
    )
  })
})

function unreviewedOr(ids: string[]): string {
  return ids.length ? ids.join("\n") : ""
}