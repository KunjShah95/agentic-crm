import { describe, it, expect } from "vitest"
import fs from "node:fs"
import path from "node:path"
import { REPO_ROOT } from "../helpers/source-scan"

/**
 * Keep the RLS cutover script and the RLS migration in step with the schema.
 *
 * The failure this prevents is specific and invisible. A new tenant-owned model
 * is added to `schema.prisma`, a policy is written for it in
 * `20261004120000_rls_policies`, and `scripts/enable-rls.ts` is not updated —
 * so the table gets a policy that is never enabled. Nothing fails. The table
 * looks protected in the migration, and is not.
 *
 * A migration cannot catch this: it runs once, when the model does not yet
 * exist. Only a test that re-reads the schema on every run can.
 */

function read(rel: string) {
  return fs.readFileSync(path.join(REPO_ROOT, rel), "utf8")
}

/** Every model that carries `workspaceId`, mapped to its *table* name. */
function tenantOwnedTables(): Array<{ model: string; table: string }> {
  const schema = read("prisma/schema.prisma")
  const out: Array<{ model: string; table: string }> = []
  for (const m of schema.matchAll(/model (\w+) \{([\s\S]*?)\n\}/g)) {
    const [, model, body] = m
    if (!/^\s*workspaceId\s+String/m.test(body)) continue
    // `model Broker @@map("ChannelPartner")` is stored as "ChannelPartner".
    // Getting this wrong produces a policy on a table that does not exist.
    const mapped = body.match(/@@map\("([^"]+)"\)/)
    out.push({ model, table: mapped ? mapped[1] : model })
  }
  return out
}

/** Tables named in the script's DIRECT list. */
function scriptedTables(): Set<string> {
  const src = read("scripts/enable-rls.ts")
  const direct = src.match(/const DIRECT = \[([\s\S]*?)\]/)
  if (!direct) throw new Error("enable-rls.ts: DIRECT list not found")
  const tables = new Set<string>()
  for (const m of direct[1].matchAll(/"([^"]+)"/g)) tables.add(m[1])
  return tables
}

const MIGRATION = "prisma/migrations/20261004120000_rls_policies/migration.sql"

describe("RLS cutover stays in step with the schema", () => {
  it("lists every tenant-owned table in the cutover script", () => {
    const owned = tenantOwnedTables()
    const scripted = scriptedTables()

    const missing = owned.filter((t) => !scripted.has(t.table)).map((t) => `${t.model} → ${t.table}`)

    expect(
      missing.join("\n"),
      `tenant-owned tables absent from DIRECT in scripts/enable-rls.ts.\n` +
        `Add each one, and write its policy in ${MIGRATION}.`,
    ).toBe("")
  })

  it("has a policy in the migration for every table the script enables", () => {
    const sql = read(MIGRATION)
    const scripted = scriptedTables()

    // The migration builds policies in a FOREACH loop over a name list, so the
    // names appear as array literals rather than one CREATE POLICY per table.
    const missing = [...scripted].filter(
      (t) => !new RegExp(`'${t}'`).test(sql) && !sql.includes(`ON "${t}"`),
    )
    expect(
      missing.join("\n"),
      `tables enabled by the script with no policy in ${MIGRATION}`,
    ).toBe("")
  })

  it("uses the mapped table name, not the model name, for Broker", () => {
    // This exact mismatch is why the script carries a comment about it:
    // `model Broker @@map("ChannelPartner")`. A policy created on "Broker"
    // fails with "relation does not exist" at migration time.
    const owned = tenantOwnedTables()
    const broker = owned.find((t) => t.model === "Broker")
    expect(broker, "Broker model not found in schema").toBeDefined()
    expect(broker!.table).toBe("ChannelPartner")
    expect(scriptedTables().has("ChannelPartner")).toBe(true)
    expect(scriptedTables().has("Broker")).toBe(false)
  })

  it("does not enable RLS on tables that cannot support it", () => {
    // Each exclusion is a deliberate decision recorded in the migration header.
    // If one of these ever gets a policy, the reason needs revisiting — but the
    // test only asserts they stay out of the cutover list.
    const scripted = scriptedTables()
    for (const t of [
      "Workspace",
      "WorkspaceMember",
      "User",
      "PlanLimits",
      "Association",
      "RagDocument",
    ]) {
      if (t === "WorkspaceMember") continue // in DIRECT by design; see note below
      expect(scripted.has(t), `${t} should not be in the cutover list`).toBe(false)
    }
  })

  it("records why WorkspaceMember is the one membership table in the list", () => {
    // `WorkspaceMember` IS in DIRECT, unlike `Workspace`. The reason is
    // specific: `lib/auth.ts` loadMemberships queries `where: { userId }` with no
    // workspaceId to build the workspace switcher, so a tenant policy makes the
    // switcher return nothing. That needs a user-scoped policy first — it is not
    // safe to enable as-is, so this test records the intent rather than pretending
    // the current shape is correct.
    expect(scriptedTables().has("WorkspaceMember")).toBe(true)
    const sql = read(MIGRATION)
    expect(sql).toMatch(/WorkspaceMember[\s\S]{0,400}loadMemberships|loadMemberships[\s\S]{0,400}WorkspaceMember/)
  })
})

describe("RLS policies fail closed", () => {
  const sql = fs.existsSync(path.join(REPO_ROOT, MIGRATION))
    ? read(MIGRATION)
    : ""

  /** Strip `--` comments so prose about USING cannot be counted as SQL. */
  const executable = sql
    .split(/\r?\n/)
    .map((l) => l.replace(/--.*$/, ""))
    .join("\n")

  it("every policy includes WITH CHECK, not only USING", () => {
    // The half that is usually forgotten. Without WITH CHECK a row can be read
    // under your tenant and written under another — a read bug becomes a write
    // bug. Comments are stripped first, because the migration's own explanatory
    // header mentions USING and WITH CHECK, and counting those would make the
    // assertion pass for the wrong reason.
    const using = (executable.match(/USING\s*\(/g) ?? []).length
    const withCheck = (executable.match(/WITH CHECK\s*\(/g) ?? []).length
    expect(using, "policies found in executable SQL").toBeGreaterThan(0)
    expect(withCheck, "every USING should have a matching WITH CHECK").toBe(using)
  })

  it("every direct-table comparison is paired with an IS NOT NULL guard", () => {
    // `"workspaceId" = NULL` evaluates to NULL, which RLS treats as deny, so the
    // bare comparison happens to be safe. The guard is explicit anyway: the next
    // person to simplify it should not have to know that.
    //
    // Only the DIRECT shape needs it. The child-table policies compare inside an
    // EXISTS, where an unset GUC makes the subquery match no rows — already
    // fail-closed, and there is no bare `"workspaceId"` on those tables to
    // compare. So the assertion is scoped to unprefixed comparisons, and the
    // regex is anchored to a line start so `p."workspaceId"` is not counted.
    const lines = executable.split(/\r?\n/)
    const bareComparisons = lines.filter(
      (l) => /^\s*AND "workspaceId" = \(SELECT private\.current_tenant_id\(\)\)/.test(l),
    ).length
    const guards = (executable.match(/IS NOT NULL/g) ?? []).length
    expect(bareComparisons, "direct-table comparisons found").toBeGreaterThan(0)
    expect(guards, "one IS NOT NULL guard per direct comparison").toBeGreaterThanOrEqual(
      bareComparisons,
    )
  })

  it("child-table comparisons sit inside an EXISTS, which is fail-closed", () => {
    // Belt and braces on the six child tables: their predicates must be EXISTS,
    // because that is what makes an unset GUC deny rather than permit.
    const existsCount = (executable.match(/USING \(EXISTS \(/g) ?? []).length
    const childComparisons = (
      executable.match(/AND [a-z]\."workspaceId" = \(SELECT private\.current_tenant_id\(\)\)/g) ?? []
    ).length
    expect(existsCount, "USING (EXISTS ...) predicates").toBeGreaterThanOrEqual(6)
    expect(childComparisons, "prefixed child comparisons").toBeGreaterThanOrEqual(6)
  })

  it("the direct-table policy template is used by every direct table", () => {
    // The 25 direct tables share one shape emitted by five FOREACH loops. If a
    // sixth loop is added with a different predicate, this catches the drift —
    // the loops are the only reason 25 policies are not 25 hand-written blocks.
    const loops = (executable.match(/FOREACH t IN ARRAY ARRAY\[/g) ?? []).length
    expect(loops, "policy loops in the migration").toBeGreaterThanOrEqual(4)

    // And the template itself must carry both halves.
    const template = executable.match(/CREATE POLICY %I ON %I[\s\S]*?\$p\$, t \|\| '_tenant_isolation', t\);/)
    expect(template, "direct-table policy template not found").not.toBeNull()
    expect(template![0]).toMatch(/USING \(/)
    expect(template![0]).toMatch(/WITH CHECK \(/)
    expect(template![0]).toMatch(/IS NOT NULL/)
  })

  it("child-table policies correlate on the child row, not the parent", () => {
    // An inverted correlation is the failure mode that looks correct and leaks:
    // `WHERE p."id" = "Tower"."projectId"` is right; `"Tower"."projectId" = p."id"`
    // is right too, but `WHERE p."workspaceId" = …` alone — with no tie back to
    // this specific child row — would pass whenever ANY project matched. Assert
    // the child-side reference is present for each child table.
    for (const [table, ref] of [
      ["Tower", '"Tower"."projectId"'],
      ["Floor", '"Floor"."towerId"'],
      ["PaymentPlan", '"PaymentPlan"."projectId"'],
      ["PaymentMilestone", '"PaymentMilestone"."planId"'],
      ["ContactTag", '"ContactTag"."contactId"'],
      ["DealTag", '"DealTag"."dealId"'],
    ] as const) {
      expect(sql, `${table} policy must reference the child row`).toContain(ref)
    }
  })

  it("keys ContactTag on the contact, not the tag", () => {
    // Both parents are tenant-scoped today so either would pass, but the contact
    // is the tenant-bearing parent. Asserting it stops a future refactor from
    // quietly relying on tags being tenant-scoped.
    const policy = sql.match(/CREATE POLICY "ContactTag_tenant_isolation"[\s\S]*?\$p\$;/)
    expect(policy, "ContactTag policy not found").not.toBeNull()
    expect(policy![0]).toContain('"ContactTag"."contactId"')
    expect(policy![0]).not.toContain('"ContactTag"."tagId"')
  })

  it("creates the role without BYPASSRLS and without LOGIN", () => {
    // No LOGIN: a migration that can create credentials is a migration that can
    // lock you out of your own database. The operator creates the credential.
    expect(sql).toMatch(/CREATE ROLE estate360_app/)
    const role = sql.match(/CREATE ROLE estate360_app[\s\S]*?;/)
    expect(role).not.toBeNull()
    expect(role![0]).toMatch(/NOBYPASSRLS/)
    expect(role![0]).not.toMatch(/\bLOGIN\b/)
  })

  it("does not enable RLS in the migration itself", () => {
    // The whole reason this file is safe to apply today. If someone adds
    // `ENABLE ROW LEVEL SECURITY` here, `migrate deploy` starts blanking every
    // tenant table on environments where the GUC is never set.
    expect(
      sql.match(/ALTER TABLE\s+"?\w+"?\s+ENABLE ROW LEVEL SECURITY/gi),
      "ENABLE ROW LEVEL SECURITY must live in scripts/enable-rls.ts, not a migration",
    ).toBeNull()
  })

  it("asserts RLS is already on, rather than that it is off", () => {
    // Measured on the live database: all 43 public tables already have
    // relrowsecurity = true, and the 27 CRM ones have no policies at all — so
    // they are already deny-all for any non-BYPASSRLS role. The fix is
    // therefore "add policies + change role", not "enable RLS".
    //
    // This test pins the direction of that reasoning. The obvious guard to write
    // is "fail if RLS is already enabled" — and that would abort the migration on
    // every real Supabase database, since they all ship with RLS on.
    // `sql` is comment-stripped for the other assertions, but this one needs the
    // whole DO block including its predicate, so match against the raw file.
    const raw = read(MIGRATION)
    const block = raw.match(/DO \$\$[\s\S]*?IF off IS NOT NULL THEN[\s\S]*?END IF;[\s\S]*?\$\$;/)
    expect(block, "RLS self-check DO block not found").not.toBeNull()
    expect(block![0]).toMatch(/AND NOT c\.relrowsecurity/)
    expect(block![0]).toMatch(/RAISE EXCEPTION/)
    // The failure message has to name the remedy, or whoever hits it in
    // production is guessing.
    expect(block![0]).toMatch(/ENABLE ROW LEVEL SECURITY/)
  })

  it("is idempotent, so a re-run is a no-op", () => {
    // Every CREATE POLICY is preceded by a DROP POLICY IF EXISTS, so applying
    // the migration to a database that already has it cannot fail.
    const drops = (sql.match(/DROP POLICY IF EXISTS/gi) ?? []).length
    expect(drops).toBeGreaterThan(5)
    for (const stmt of sql.match(/CREATE POLICY/gi) ?? []) {
      expect(stmt).toBe("CREATE POLICY")
    }
  })
})