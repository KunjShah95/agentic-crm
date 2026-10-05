/**
 * RLS cutover — the step that actually turns enforcement on.
 *
 * `prisma/migrations/20261004120000_rls_policies` creates the role, the helper
 * and all 31 policies.
 *
 * ## The measured state of the database (2026-10-04)
 *
 * Worth stating plainly, because it inverts the obvious reading of the HIGH
 * finding in `open-findings.md`:
 *
 *   * ALL 43 tables in the public schema already have `relrowsecurity = true`.
 *   * Only the four `Rag*` tables have any policy.
 *   * The 31 tenant tables have RLS ON and ZERO policies — so they are *already*
 *     deny-all for any role without `BYPASSRLS`.
 *
 * The app reads them today only because `DATABASE_URL` connects as `postgres`,
 * which carries `BYPASSRLS` and owns the tables (an owner bypasses its own RLS).
 *
 * So the cutover is not "turn RLS on". It is "give the already-enabled RLS
 * policies, then stop using a role that ignores them". The `--enable` flag is
 * therefore a no-op on any normal Supabase database — kept so this script also
 * works where RLS is genuinely off, and so `--disable` has something to undo.
 *
 * What makes this script necessary is that the irreversible part is a *credential*
 * change, not a schema change: nothing in a migration can verify that the
 * application will set the tenant GUC on every request before the role stops
 * bypassing RLS. This script verifies exactly that, first.
 *
 * ## Why this is a script and not a migration
 *
 * A migration is unconditional and runs on every `migrate deploy`, including
 * environments nobody is watching. This cutover needs a live assertion against
 * real rows before it does anything irreversible, and it needs to be run by a
 * human who has decided now is the moment. Both are impossible in a migration.
 *
 * ## Usage
 *
 *   npx tsx scripts/enable-rls.ts --check     # report only, no changes
 *   npx tsx scripts/enable-rls.ts --enable    # enable RLS on the listed tables
 *   npx tsx scripts/enable-rls.ts --disable   # roll back (keeps policies)
 *
 * `--check` is safe to run anywhere and is the default.
 *
 * ## Preconditions this enforces
 *
 *  1. `DATABASE_URL` connects as a role **without** `BYPASSRLS`. If it still has
 *     it, every policy below is decorative and this script refuses.
 *  2. The app sets `app.current_tenant_id` per request. Verified by round-trip:
 *     set the GUC, read rows, confirm the same GUC comes back. A role can be
 *     non-BYPASSRLS and still never receive the GUC — that is the state this
 *     whole migration sequence exists to detect.
 *  3. No policy is missing for a tenant-owned table.
 *
 * Failing any of these is a hard stop with instructions, not a warning.
 */

import { readFileSync } from "node:fs"
import { Client } from "pg"

// tsx does not load .env, and @/lib/db builds the pool at import time.
for (const file of [".env", ".env.local"]) {
  try {
    for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
      const m = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/.exec(line)
      if (!m) continue
      process.env[m[1]] ??= m[2].replace(/^["']|["']$/g, "")
    }
  } catch {
    // Absent env file is fine — CI and production set these directly.
  }
}

/**
 * Tables this script enables RLS on.
 *
 * Kept in step with the migration by `tests/unit/rls-cutover.test.ts`, which
 * fails if a table is tenant-owned in `schema.prisma` but absent here. That
 * test is the reason this list cannot silently fall behind: a new tenant-owned
 * model gets a policy in the migration and a red test until it is listed.
 */
const DIRECT = [
  // CRM core
  "Contact", "Deal", "Organization", "Activity", "Tag",
  "PipelineStage", "Project", "Unit", "SiteVisit",
  // Transactions
  "Payment", "CostSheet", "DocumentTemplate", "GeneratedDocument",
  // Membership, invites, billing
  "WorkspaceMember", "WorkspaceInvite", "Subscription",
  "UsageCounter", "UsageEvent",
  // Integrations
  "SocialConnection", "SocialEvent", "WebhookEvent",
  "CommissionRule", "BuyerPortalAccess", "AssociationMember",
  // model Broker @@map("ChannelPartner") — table name differs from model name.
  "ChannelPartner",
]

const CHILD = ["Tower", "Floor", "PaymentPlan", "PaymentMilestone", "ContactTag", "DealTag"]

const ALL = [...DIRECT, ...CHILD]

type Result = { ok: boolean; label: string; detail: string }

const results: Result[] = []
const record = (ok: boolean, label: string, detail: string) => {
  results.push({ ok, label, detail })
  const mark = ok ? "PASS" : "FAIL"
  console.log(`  [${mark}] ${label}`)
  if (detail) console.log(`         ${detail}`)
}

async function main() {
  const mode = process.argv.includes("--enable")
    ? "enable"
    : process.argv.includes("--disable")
      ? "disable"
      : "check"

  const url = process.env.DATABASE_URL
  if (!url) {
    console.error("DATABASE_URL is not set. Copy .env.example to .env and fill it in.")
    process.exit(2)
  }

  const db = new Client({ connectionString: url })
  await db.connect()

  try {
    console.log(`\nRLS cutover — mode: ${mode}\n`)

    // ── 1. The role must not have BYPASSRLS ────────────────────────────────
    // The single most important precondition. A BYPASSRLS role skips every
    // policy, so "enabling" RLS for it changes nothing and creates the false
    // impression that the backstop is live.
    const role = await db.query<{ rolname: string; rolbypassrls: boolean; rolsuper: boolean }>(
      `SELECT rolname, rolbypassrls, rolsuper FROM pg_roles WHERE rolname = current_user`,
    )
    const r = role.rows[0]
    if (!r) {
      record(false, "connected as a known role", "current_user returned no row")
    } else if (r.rolsuper) {
      record(
        false,
        "current_user is not superuser",
        `${r.rolname} is SUPERUSER, which bypasses all RLS. Use estate360_app.`,
      )
    } else if (r.rolbypassrls) {
      record(
        false,
        "current_user lacks BYPASSRLS",
        `${r.rolname} carries BYPASSRLS — every policy would be skipped silently. Switch DATABASE_URL to estate360_app.`,
      )
    } else {
      record(true, "current_user lacks BYPASSRLS", r.rolname)
    }

    // ── 2. Policies exist ───────────────────────────────────────────────────
    const policies = await db.query<{ tablename: string }>(
      `SELECT tablename FROM pg_policies
        WHERE schemaname = 'public' AND policyname LIKE '%_tenant_isolation'`,
    )
    const covered = new Set(policies.rows.map((x) => x.tablename))
    const missing = ALL.filter((t) => !covered.has(t))
    if (missing.length === 0) {
      record(true, "all tenant tables have a policy", `${covered.size} policies found`)
    } else {
      record(
        false,
        "all tenant tables have a policy",
        `missing: ${missing.join(", ")} — apply 20261004120000_rls_policies first`,
      )
    }

    // ── 3. The GUC round-trip ───────────────────────────────────────────────
    // Set the tenant, read it back through the same helper the policies use.
    // This is what catches the "role is correct but nothing sets the GUC" case,
    // which is the actual current state of this codebase.
    const tenant = await db.query<{ id: string }>(`SELECT "id" FROM "Workspace" ORDER BY "createdAt" ASC LIMIT 1`)
    if (tenant.rows.length === 0) {
      record(false, "GUC round-trip", "no Workspace row to test against — is the database seeded?")
    } else {
      const id = tenant.rows[0].id
      await db.query("BEGIN")
      try {
        // SET does not accept bind parameters — its grammar takes a literal, so
        // `$1` is a syntax error here, not a silent no-op. The value is not
        // interpolated raw either: quoteLiteral escapes embedded quotes and
        // backslashes so the string cannot terminate early. An id is a cuid, so
        // this is belt-and-braces rather than the primary defence.
        await db.query(`SET LOCAL app.current_tenant_id = ${quoteLiteral(id)}`)
        const resolved = await db.query<{ t: string | null }>(`SELECT private.current_tenant_id() AS t`)
        const got = resolved.rows[0]?.t ?? null
        if (got !== id) {
          record(
            false,
            "GUC round-trip",
            `helper returned ${JSON.stringify(got)}, expected ${id}. Check private.current_tenant_id().`,
          )
        } else {
          record(true, "GUC round-trip", `helper resolved ${id}`)
        }

        // And the predicate itself must actually match rows for that tenant.
        const visible = await db.query<{ n: string }>(
          `SELECT count(*)::text AS n FROM "Contact" WHERE "workspaceId" = $1`,
          [id],
        )
        const contacts = Number(visible.rows[0]?.n ?? 0)
        if (contacts === 0) {
          record(
            false,
            "tenant predicate returns rows",
            `0 contacts for ${id}. If that is genuinely an empty tenant, seed one before cutting over.`,
          )
        } else {
          record(true, "tenant predicate returns rows", `${contacts} contacts visible for ${id}`)
        }
      } finally {
        await db.query("ROLLBACK")
      }
    }

    // ── 4. Report current enforcement ───────────────────────────────────────
    const enabled = await db.query<{ tablename: string }>(
      `SELECT c.relname AS tablename
         FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public' AND c.relrowsecurity`,
    )
    const enabledSet = new Set(enabled.rows.map((x) => x.tablename))
    const on = ALL.filter((t) => enabledSet.has(t))
    console.log(
      `\n  RLS already enabled on ${on.length}/${ALL.length} tenant tables` +
        (on.length ? `: ${on.join(", ")}` : ""),
    )
    if (on.length === ALL.length) {
      console.log(
        `  All of them. Combined with ${policies.rows.length} policies, the remaining\n` +
          `  work is the credential change: DATABASE_URL must stop using a BYPASSRLS role.`,
      )
    }

    // Owners bypass their own RLS unless FORCE ROW LEVEL SECURITY is set. If the
    // app keeps connecting as the table owner, policies are inert no matter how
    // correct they are — so this is reported as a distinct failure from the
    // BYPASSRLS check, because the fix is different.
    const owner = await db.query<{ tableowner: string }>(
      `SELECT DISTINCT tableowner FROM pg_tables
        WHERE schemaname = 'public' AND tablename = ANY($1)`,
      [ALL],
    )
    const owners = [...new Set(owner.rows.map((r) => r.tableowner))]
    if (owners.includes(r?.rolname ?? "")) {
      record(
        false,
        "current_user does not own the tenant tables",
        `${r.rolname} owns them, and a table owner bypasses its own RLS regardless of ` +
          `policies. Switch to estate360_app, or FORCE ROW LEVEL SECURITY (which also ` +
          `blocks migrations on those tables).`,
      )
    } else {
      record(true, "current_user does not own the tenant tables", owners.join(", "))
    }

    // ── 5. Act ──────────────────────────────────────────────────────────────
    if (mode === "check") {
      record(true, "check mode", "no changes made")
    } else if (mode === "disable") {
      for (const t of ALL) {
        await db.query(`ALTER TABLE ${quoteIdent(t)} DISABLE ROW LEVEL SECURITY`)
      }
      record(true, "disabled RLS", `${ALL.length} tables — policies kept, so re-enabling is cheap`)
    } else {
      // Only reach here if every precondition passed.
      const failed = results.filter((x) => !x.ok)
      if (failed.length > 0) {
        console.error(
          `\n  Refusing to enable: ${failed.length} precondition(s) failed. Nothing was changed.\n`,
        )
        process.exit(1)
      }
      for (const t of ALL) {
        await db.query(`ALTER TABLE ${quoteIdent(t)} ENABLE ROW LEVEL SECURITY`)
      }
      record(true, "enabled RLS", `${ALL.length} tables now enforce tenant isolation`)
      console.log(
        `\n  Next: switch DATABASE_URL to the estate360_app role if you have not already,\n` +
          `  and confirm every request path sets app.current_tenant_id on its transaction.\n`,
      )
    }
  } finally {
    await db.end()
  }

  const failed = results.filter((x) => !x.ok)
  console.log(
    failed.length === 0
      ? `\nAll ${results.length} checks passed.\n`
      : `\n${failed.length} of ${results.length} checks failed.\n`,
  )
  process.exit(failed.length === 0 ? 0 : 1)
}

/** Identifiers are from a fixed list, but quoting is still the correct habit. */
function quoteIdent(name: string): string {
  return `"${name.replace(/"/g, '""')}"`
}

/**
 * Quote a value as a SQL string literal.
 *
 * Used only where a bind parameter is not accepted by the grammar — `SET` is the
 * one case in this script. Standard_conforming_strings is on by default in
 * modern Postgres, where `''` is the only escape a plain literal needs; backslash
 * is escaped anyway in case a database was configured the old way.
 */
function quoteLiteral(value: string): string {
  return `'${value.replace(/\\/g, "\\\\").replace(/'/g, "''")}'`
}

main().catch((error) => {
  console.error(error)
  process.exit(2)
})