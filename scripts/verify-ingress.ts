/**
 * Verify the lead-ingest hardening against a real workspace, over real HTTP.
 *
 * Unit tests prove the gate logic. This proves the thing that actually matters:
 * that an *unauthenticated* POST is refused and an *authenticated* one lands a
 * scored, routed lead — against the same code path a customer's portal would
 * hit. Run it before quoting inbound lead capture to anyone.
 *
 * It creates a throwaway workspace, exercises four cases, then deletes the
 * workspace. Nothing customer-facing is touched.
 *
 * Usage:
 *   npm run pilot:verify            # starts nothing; needs a running app
 *   npm run pilot:verify -- --base-url http://localhost:3000
 *
 * Requires the app to be running (`npm run dev` or `npm start`) and points at
 * the same DATABASE_URL, because the script confirms rows landed in the DB.
 */

import "dotenv/config"
import { db } from "@/lib/db"
import { createIngestSecret, setAutoAck } from "@/modules/leadIngest/ingress"

/**
 * Base URL resolution is deliberately liberal: npm swallows `--base-url` in
 * some argument positions, so accept `--base-url=x`, `--base-url x`, a bare
 * positional URL, and finally the env var.
 */
function resolveBaseUrl(argv: string[]): string {
  const flagIndex = argv.findIndex((a) => a === "--base-url" || a.startsWith("--base-url="))
  let value: string | undefined
  if (flagIndex > -1) {
    const arg = argv[flagIndex]
    value = arg.startsWith("--base-url=") ? arg.split("=")[1] : argv[flagIndex + 1]
  }
  if (!value) value = argv.find((a) => /^https?:\/\//.test(a))
  return (value ?? process.env.PILOT_BASE_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").replace(/\/$/, "")
}

const BASE = resolveBaseUrl(process.argv.slice(2))

const SLUG = `ingest-verify-${Date.now().toString(36)}`
const EMAIL = `${SLUG}@verify.local`

type Result = { name: string; pass: boolean; detail: string }
const results: Result[] = []

function check(name: string, pass: boolean, detail = "") {
  results.push({ name, pass, detail })
  console.log(`   ${pass ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`)
}

async function post(path: string, body: unknown, headers: Record<string, string> = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify(body),
  })
  const text = await res.text()
  let json: unknown
  try {
    json = JSON.parse(text)
  } catch {
    json = text
  }
  return { status: res.status, json }
}

async function main() {
  console.log(`\nVerifying lead ingress at ${BASE}\n`)

  // ── Fixture ───────────────────────────────────────────────────────────────
  const owner = await db.user.create({ data: { email: EMAIL, name: "Ingress Verify" } })
  const workspace = await db.workspace.create({
    data: {
      name: "Ingress Verify",
      slug: SLUG,
      stages: { create: [{ name: "Enquiry", color: "#64748b", order: 0 }] },
    },
  })
  await db.workspaceMember.create({
    data: { workspaceId: workspace.id, userId: owner.id, role: "OWNER" },
  })
  const { secret } = await createIngestSecret(workspace.id, owner.id)
  console.log(`   Fixture workspace ${SLUG}\n`)

  const webhook = `/api/webhooks/leads/meta?workspace=${SLUG}`
  const lead = { name: "Verify Buyer", phone: "+919800012345", config: "3BHK", intent: "HOT" }

  try {
    // ── 1. Unauthenticated POST is refused ────────────────────────────────
    const anon = await post(webhook, lead)
    check(
      "unauthenticated webhook POST is refused",
      anon.status === 401,
      `expected 401, got ${anon.status}`
    )

    // ── 2. Wrong key is refused ────────────────────────────────────────────
    const wrong = await post(webhook, lead, { "x-estate360-ingest-key": "lei_not_the_key" })
    check("wrong ingest key is refused", wrong.status === 401, `got ${wrong.status}`)

    // ── 3. Nothing was written by the refused requests ─────────────────────
    const contactsAfterRejects = await db.contact.count({ where: { workspaceId: workspace.id } })
    check(
      "refused requests wrote nothing",
      contactsAfterRejects === 0,
      `${contactsAfterRejects} contact(s) created by rejected calls`
    )

    // ── 4. Authenticated POST lands a scored, routed lead ──────────────────
    const ok = await post(webhook, lead, { "x-estate360-ingest-key": secret })
    const contactId = (ok.json as { contactId?: string })?.contactId
    check(
      "authenticated webhook POST is accepted",
      ok.status === 200 && Boolean(contactId),
      `status ${ok.status}`
    )

    const contact = contactId
      ? await db.contact.findUnique({ where: { id: contactId }, select: { phone: true, leadScore: true } })
      : null
    check("lead was materialized as a Contact", Boolean(contact?.phone))
    check("lead was scored", (contact?.leadScore ?? 0) > 0, `score ${contact?.leadScore}`)

    const dealCount = await db.deal.count({ where: { workspaceId: workspace.id } })
    check("deal created and routed to a stage", dealCount === 1, `${dealCount} deal(s)`)

    // ── 5. The response reports no outbound message ────────────────────────
    const acked = (ok.json as { acked?: boolean })?.acked
    check(
      "no WhatsApp sent while auto-ack is off",
      acked === false,
      `acked=${String(acked)}`
    )

    // ── 6. Dedupe still holds for a repeat of the same event ────────────────
    // The dedupe path deliberately returns no contactId, so assert on what it
    // does report and on the row counts. Comparing ids here would pass even if
    // a duplicate contact were created.
    const dupe = await post(webhook, lead, { "x-estate360-ingest-key": secret })
    const dupeBody = dupe.json as { deduped?: boolean; contactId?: string }
    check("identical resubmit is reported as deduped", dupeBody.deduped === true)
    check("deduped resubmit does not re-emit a contact id", dupeBody.contactId === undefined)
    const contactsAfterDupe = await db.contact.count({ where: { workspaceId: workspace.id } })
    check(
      "deduped resubmit created no second contact",
      contactsAfterDupe === 1,
      `${contactsAfterDupe} contact(s) total`
    )
    const dealsAfterDupe = await db.deal.count({ where: { workspaceId: workspace.id } })
    check(
      "deduped resubmit created no second deal",
      dealsAfterDupe === 1,
      `${dealsAfterDupe} deal(s) total`
    )

    // ── 7. Opt-in turns outbound on ─────────────────────────────────────────
    await setAutoAck(workspace.id, true, owner.id)
    const optedIn = await post(webhook, { ...lead, phone: "+919800099999", lead_id: "opt-in-1" }, {
      "x-estate360-ingest-key": secret,
    })
    const optInContact = (optedIn.json as { contactId?: string })?.contactId
    const outActivity = optInContact
      ? await db.activity.count({
          where: { contactId: optInContact, channel: "WHATSAPP", direction: "OUT" },
        })
      : 0
    check(
      "auto-ack sends once the workspace opts in",
      outActivity > 0,
      `${outActivity} outbound activity(ies)`
    )
  } finally {
    // Cascades to contacts, deals, activities, stages, memberships.
    await db.workspace.delete({ where: { id: workspace.id } }).catch(() => {})
    await db.user.delete({ where: { id: owner.id } }).catch(() => {})
  }

  const failed = results.filter((r) => !r.pass)
  console.log(
    `\n${results.length - failed.length}/${results.length} checks passed` +
      (failed.length ? `  — ${failed.map((f) => f.name).join("; ")}` : "")
  )
  if (failed.length) process.exitCode = 1
}

main()
  .catch((err) => {
    console.error("\nVerification failed:", err instanceof Error ? err.message : err)
    process.exitCode = 1
  })
  .finally(async () => {
    await db.$disconnect()
  })