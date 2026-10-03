/**
 * Duplicate-row check.
 *
 * The dashboard aggregates count rows, not distinct business objects, so a
 * re-import or a double submission inflates every total on the page with no
 * visible sign — the numbers all move together and stay internally consistent,
 * which is exactly what makes it hard to notice. This reports the rows.
 *
 * **Read-only by design.** It prints candidate ids and exits non-zero when it
 * finds anything, so it works as a pre-deploy gate or a cron check. It does not
 * delete: deciding which of two identical rows to keep is a judgement call
 * (the older one may own activities, tags, payments or cost sheets, and this
 * script cannot see the ones that would be orphaned), and silently deleting
 * CRM rows on a heuristic is not something to do on someone's live data.
 *
 *   npx tsx scripts/check-duplicates.ts              # human report
 *   npx tsx scripts/check-duplicates.ts --json       # machine-readable
 *
 * Exit code 1 when duplicates exist, 0 when clean.
 */

import { readFileSync } from "node:fs"

// tsx does not load .env, and `@/lib/db` builds the pool at import time.
for (const file of [".env", ".env.local"]) {
  try {
    for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
      const match = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/.exec(line)
      if (!match) continue
      process.env[match[1]] ??= match[2].replace(/^["']|["']$/g, "")
    }
  } catch {
    // Absent env file is fine — CI and production set these directly.
  }
}

type DupeGroup<T> = { key: string; rows: T[] }

async function main() {
  const json = process.argv.includes("--json")
  const { db } = await import("@/lib/db")

  const workspaces = await db.workspace.findMany({
    select: { id: true, slug: true, name: true },
    orderBy: { slug: "asc" },
  })

  const report: Array<Record<string, unknown>> = []
  let totalGroups = 0

  for (const ws of workspaces) {
    // ── Deals ──────────────────────────────────────────────────────────────
    // Identity is title + stage + value + currency. Two rows agreeing on all
    // four are the same deal entered twice; a re-titled or re-priced deal is a
    // legitimate edit and is left alone.
    const deals = await db.deal.findMany({
      where: { workspaceId: ws.id },
      select: {
        id: true,
        title: true,
        value: true,
        currency: true,
        stageId: true,
        contactId: true,
        createdAt: true,
        stage: { select: { name: true } },
        _count: { select: { activities: true, tags: true, payments: true, costSheetsAsDeal: true, siteVisits: true } },
      },
      orderBy: { createdAt: "asc" },
    })

    const dealGroups = new Map<string, typeof deals>()
    for (const deal of deals) {
      const key = [deal.title, deal.stageId, deal.value ?? "null", deal.currency].join("|")
      const bucket = dealGroups.get(key)
      if (bucket) bucket.push(deal)
      else dealGroups.set(key, [deal])
    }

    const dealDupes = [...dealGroups.entries()]
      .filter(([, rows]) => rows.length > 1)
      .map(([key, rows]): DupeGroup<(typeof deals)[number]> => ({ key, rows }))

    // ── Contacts ───────────────────────────────────────────────────────────
    // Email is the identity, and it is the one field with a natural key.
    // Contacts with no email at all cannot be matched on anything trustworthy,
    // so they are reported as a separate count rather than guessed at.
    const contacts = await db.contact.findMany({
      where: { workspaceId: ws.id },
      select: { id: true, email: true, firstName: true, lastName: true, createdAt: true },
      orderBy: { createdAt: "asc" },
    })

    const contactGroups = new Map<string, typeof contacts>()
    let emailless = 0
    for (const contact of contacts) {
      if (!contact.email) {
        emailless += 1
        continue
      }
      const key = contact.email.trim().toLowerCase()
      const bucket = contactGroups.get(key)
      if (bucket) bucket.push(contact)
      else contactGroups.set(key, [contact])
    }

    const contactDupes = [...contactGroups.entries()]
      .filter(([, rows]) => rows.length > 1)
      .map(([key, rows]): DupeGroup<(typeof contacts)[number]> => ({ key, rows }))

    totalGroups += dealDupes.length + contactDupes.length

    report.push({
      workspace: ws.slug,
      counts: { deals: deals.length, contacts: contacts.length, contactsWithoutEmail: emailless },
      duplicateDeals: dealDupes.map((g) => ({
        identity: g.key.split("|").slice(0, 3).join(" | "),
        stage: g.rows[0].stage.name,
        copies: g.rows.length,
        // The oldest row is the one to keep: it is the one any child rows
        // (activities, tags, payments) most likely hang off.
        keep: g.rows[0].id,
        candidates: g.rows.map((r) => ({
          id: r.id,
          createdAt: r.createdAt.toISOString(),
          childRows: r._count,
          contactId: r.contactId,
        })),
      })),
      duplicateContacts: contactDupes.map((g) => ({
        email: g.key,
        copies: g.rows.length,
        keep: g.rows[0].id,
        candidates: g.rows.map((r) => ({ id: r.id, createdAt: r.createdAt.toISOString() })),
      })),
    })
  }

  if (json) {
    console.log(JSON.stringify({ totalGroups, workspaces: report }, null, 2))
  } else {
    for (const ws of report) {
      const deals = ws.duplicateDeals as Array<Record<string, unknown>>
      const contacts = ws.duplicateContacts as Array<Record<string, unknown>>
      const counts = ws.counts as Record<string, number>
      console.log(`\n=== ${ws.workspace} ===`)
      console.log(
        `  ${counts.deals} deals, ${counts.contacts} contacts` +
          (counts.contactsWithoutEmail ? ` (${counts.contactsWithoutEmail} with no email)` : ""),
      )
      if (!deals.length && !contacts.length) {
        console.log("  clean")
        continue
      }
      for (const group of deals) {
        console.log(`  DUPLICATE DEAL x${group.copies}  ${group.identity}  [${group.stage}]`)
        for (const row of group.candidates as Array<Record<string, unknown>>) {
          const children = row.childRows as Record<string, number>
          console.log(
            `      ${row.id}  ${row.createdAt}  activities=${children.activities} tags=${children.tags} payments=${children.payments} costSheets=${children.costSheetsAsDeal} siteVisits=${children.siteVisits}`,
          )
        }
      }
      for (const group of contacts) {
        console.log(`  DUPLICATE CONTACT x${group.copies}  ${group.email}`)
        for (const row of group.candidates as Array<Record<string, unknown>>) {
          console.log(`      ${row.id}  ${row.createdAt}`)
        }
      }
    }
    console.log(
      totalGroups === 0
        ? "\nNo duplicates found."
        : `\n${totalGroups} duplicate group(s) found. Nothing was deleted — review the ids above before removing anything.`,
    )
  }

  await db.$disconnect()
  process.exit(totalGroups === 0 ? 0 : 1)
}

main().catch((error) => {
  console.error(error)
  process.exit(2)
})