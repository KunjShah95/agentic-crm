/**
 * Provision a pilot workspace for a Managed (done-for-you) customer.
 *
 * Why this exists: the managed offer sells *labour*, and the repeatable part of
 * that labour is setup. Doing it by hand per customer means the second customer
 * costs the same as the first, and — worse — that the operator works from
 * memory, so the second customer's ingest secret ends up stored in a different
 * shape than the code expects.
 *
 * So this does the whole week-1/2 handoff in one command: workspace, owner
 * login, the real-estate pipeline, their inventory from a CSV, an authenticated
 * lead-ingest secret, and an opt-in flag for the WhatsApp auto-ack. It reuses
 * the app's own `modules/leadIngest/ingress` rather than reimplementing the
 * settings shape, because a secret written in a different shape than
 * `requireIngressAuth` reads is a secret that silently never verifies.
 *
 * Idempotent: safe to re-run when a customer adds a tower or fixes a price.
 *
 * Usage:
 *   npm run pilot:provision -- --client "Shilp Infra" --slug shilp \
 *     --owner-email hemal@shilp.in --owner-name "Hemal Shah" \
 *     --password "…" --rera "PR/GJ/…" \
 *     --inventory ./inventory.csv [--auto-ack] [--rotate-secret]
 *
 * Flag caveat: npm 11 drops `--flags` from `npm run … -- …`, so invoke this as
 * `npx tsx scripts/provision-pilot.ts --client …` when passing options.
 * Base URL precedence: `--base-url`, then a bare positional URL, then
 * `PILOT_BASE_URL`, then `NEXT_PUBLIC_APP_URL`.
 *
 * Re-running is safe and does not rotate the ingest secret unless you pass
 * `--rotate-secret` — otherwise adding a tower would break a live webhook.
 *
 * Inventory CSV columns (header row required, order-independent):
 *   project,tower,floor,unitNo,config,carpet,builtUp,facing,price,status
 * `config` ∈ BHK1 BHK2 BHK3 BHK4 VILLA PLOT SHOP OFFICE (or 1/2/3/4 bhk)
 * `status` ∈ AVAILABLE HOLD BOOKED SOLD (default AVAILABLE)
 */

import "dotenv/config"
import fs from "node:fs"
import path from "node:path"
import bcrypt from "bcryptjs"
import { db } from "@/lib/db"
import { createIngestSecret, getLeadIngestSettings, setAutoAck } from "@/modules/leadIngest/ingress"

type Args = {
  client: string
  slug: string
  ownerEmail: string
  ownerName: string
  password?: string
  rera?: string
  inventory?: string
  autoAck: boolean
  rotateSecret: boolean
  baseUrl: string
}

const UNIT_CONFIGS = ["BHK1", "BHK2", "BHK3", "BHK4", "VILLA", "PLOT", "SHOP", "OFFICE"] as const
const UNIT_STATUSES = ["AVAILABLE", "HOLD", "BOOKED", "SOLD"] as const

/**
 * The real-estate sales loop. "Won" and "Lost" are load-bearing:
 * `modules/deals/queries.ts` matches those stage names literally.
 */
const STAGES = [
  { name: "Enquiry", color: "#64748b" },
  { name: "Site Visit", color: "#3b82f6" },
  { name: "Hold", color: "#8b5cf6" },
  { name: "Booking", color: "#f59e0b" },
  { name: "Won", color: "#10b981" },
  { name: "Lost", color: "#ef4444" },
]

function parseArgs(argv: string[]): Args {
  const out: Record<string, string | boolean> = {}
  for (let i = 0; i < argv.length; i++) {
    const token = argv[i]
    if (!token.startsWith("--")) continue
    const key = token.slice(2)
    const next = argv[i + 1]
    if (next && !next.startsWith("--")) {
      out[key] = next
      i++
    } else {
      out[key] = true
    }
  }

  const required = (key: string): string => {
    const v = out[key]
    if (typeof v !== "string" || !v.trim()) {
      console.error(`Missing required --${key}`)
      process.exit(1)
    }
    return v.trim()
  }

  return {
    client: required("client"),
    slug: required("slug").toLowerCase(),
    ownerEmail: required("owner-email").toLowerCase(),
    ownerName: typeof out["owner-name"] === "string" ? out["owner-name"] : required("owner-email"),
    password: typeof out.password === "string" ? out.password : undefined,
    rera: typeof out.rera === "string" ? out.rera : undefined,
    inventory: typeof out.inventory === "string" ? out.inventory : undefined,
    autoAck: out["auto-ack"] === true || out["auto-ack"] === "true",
    rotateSecret: out["rotate-secret"] === true || out["rotate-secret"] === "true",
    baseUrl:
      (typeof out["base-url"] === "string" ? out["base-url"] : undefined) ??
      // npm can swallow `--base-url` depending on argument position, so accept
      // a bare positional URL and the env var as fallbacks.
      argv.find((a) => /^https?:\/\//.test(a)) ??
      process.env.PILOT_BASE_URL ??
      process.env.NEXT_PUBLIC_APP_URL ??
      "http://localhost:3000",
  }
}

/** Minimal RFC-4180 CSV parse. Handles quoted fields containing commas. */
function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ""
  let quoted = false

  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"'
          i++
        } else {
          quoted = false
        }
      } else {
        field += ch
      }
      continue
    }
    if (ch === '"') {
      quoted = true
    } else if (ch === ",") {
      row.push(field)
      field = ""
    } else if (ch === "\n") {
      row.push(field)
      rows.push(row)
      row = []
      field = ""
    } else if (ch !== "\r") {
      field += ch
    }
  }
  row.push(field)
  rows.push(row)

  const [header, ...body] = rows.filter((r) => r.some((c) => c.trim() !== ""))
  if (!header) return []
  const cols = header.map((h) => h.trim().toLowerCase())
  return body.map((r) => {
    const obj: Record<string, string> = {}
    cols.forEach((c, i) => {
      obj[c] = (r[i] ?? "").trim()
    })
    return obj
  })
}

function normalizeConfig(raw: string): (typeof UNIT_CONFIGS)[number] {
  const v = raw.toUpperCase().replace(/[^A-Z0-9]/g, "")
  if ((UNIT_CONFIGS as readonly string[]).includes(v)) return v as (typeof UNIT_CONFIGS)[number]
  const digit = v.replace("BHK", "")
  if (digit === "1") return "BHK1"
  if (digit === "2") return "BHK2"
  if (digit === "3") return "BHK3"
  if (digit === "4") return "BHK4"
  throw new Error(
    `Unrecognised config "${raw}". Use one of: ${UNIT_CONFIGS.join(", ")} (or 1/2/3/4 BHK).`
  )
}

function normalizeStatus(raw: string): (typeof UNIT_STATUSES)[number] {
  const v = raw.toUpperCase().replace(/[^A-Z]/g, "")
  if (!v) return "AVAILABLE"
  if ((UNIT_STATUSES as readonly string[]).includes(v)) return v as (typeof UNIT_STATUSES)[number]
  throw new Error(`Unrecognised status "${raw}". Use one of: ${UNIT_STATUSES.join(", ")}.`)
}

function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
}

async function ensureStages(workspaceId: string) {
  const existing = await db.pipelineStage.findMany({ where: { workspaceId } })
  for (let i = 0; i < STAGES.length; i++) {
    const stage = STAGES[i]
    const found = existing.find((s) => s.name === stage.name)
    if (found) {
      await db.pipelineStage.update({
        where: { id: found.id },
        data: { color: stage.color, order: i },
      })
    } else {
      await db.pipelineStage.create({
        data: { workspaceId, name: stage.name, color: stage.color, order: i },
      })
    }
  }
}

async function importInventory(workspaceId: string, file: string) {
  const abs = path.resolve(file)
  if (!fs.existsSync(abs)) {
    console.error(`Inventory file not found: ${abs}`)
    process.exit(1)
  }
  const rows = parseCsv(fs.readFileSync(abs, "utf8"))
  if (!rows.length) {
    console.log("   Inventory CSV had no data rows — skipped.")
    return { projects: 0, units: 0 }
  }

  const projects = new Map<string, string>()
  let units = 0

  for (const [index, row] of rows.entries()) {
    const lineNo = index + 2 // header is line 1
    const projectName = row.project
    if (!projectName) throw new Error(`Line ${lineNo}: "project" is required.`)
    const unitNo = row.unitno
    if (!unitNo) throw new Error(`Line ${lineNo}: "unitNo" is required.`)

    let projectId = projects.get(projectName)
    if (!projectId) {
      const project = await db.project.upsert({
        where: { workspaceId_name: { workspaceId, name: projectName } },
        update: {},
        create: {
          workspaceId,
          name: projectName,
          reraNo: args.rera ?? null,
          city: "Ahmedabad",
          type: "RESIDENTIAL",
        },
        select: { id: true },
      })
      projectId = project.id
      projects.set(projectName, projectId)
    }

    // Tower/floor are optional — a broker's sheet often has neither.
    let floorId: string | null = null
    const towerName = row.tower
    const floorNo = row.floor ? Number(row.floor) : NaN
    if (towerName && Number.isFinite(floorNo)) {
      const tower = await db.tower.upsert({
        where: { id: `${workspaceId}-${slugify(towerName)}` },
        update: { projectId, name: towerName },
        create: { id: `${workspaceId}-${slugify(towerName)}`, projectId, name: towerName, floors: floorNo },
        select: { id: true },
      })
      const floor = await db.floor.upsert({
        where: { towerId_number: { towerId: tower.id, number: floorNo } },
        update: {},
        create: { towerId: tower.id, number: floorNo },
        select: { id: true },
      })
      floorId = floor.id
    }

    await db.unit.upsert({
      where: { projectId_unitNo: { projectId, unitNo } },
      update: {
        floorId,
        config: normalizeConfig(row.config ?? ""),
        carpetArea: row.carpet ? Number(row.carpet) : null,
        builtUp: row.builtup ? Number(row.builtup) : null,
        facing: row.facing || null,
        price: row.price ? Number(row.price) : null,
        status: normalizeStatus(row.status ?? ""),
      },
      create: {
        workspaceId,
        projectId,
        floorId,
        unitNo,
        config: normalizeConfig(row.config ?? ""),
        carpetArea: row.carpet ? Number(row.carpet) : null,
        builtUp: row.builtup ? Number(row.builtup) : null,
        facing: row.facing || null,
        price: row.price ? Number(row.price) : null,
        status: normalizeStatus(row.status ?? ""),
      },
    })
    units++
  }

  return { projects: projects.size, units }
}

let args: Args

async function main() {
  args = parseArgs(process.argv.slice(2))
  const base = args.baseUrl.replace(/\/$/, "")

  console.log(`\nProvisioning pilot workspace for ${args.client}\n`)

  // ── Owner login ───────────────────────────────────────────────────────────
  const passwordHash = args.password ? await bcrypt.hash(args.password, 12) : undefined
  const owner = await db.user.upsert({
    where: { email: args.ownerEmail },
    update: { name: args.ownerName, ...(passwordHash ? { passwordHash } : {}) },
    create: {
      email: args.ownerEmail,
      name: args.ownerName,
      passwordHash: passwordHash ?? null,
    },
  })
  console.log(`   Owner  ${args.ownerEmail}`)
  if (!args.password) {
    console.log("          no --password given: use the 'forgot password' flow to set one")
  }

  // ── Workspace ─────────────────────────────────────────────────────────────
  const existing = await db.workspace.findUnique({ where: { slug: args.slug } })
  const workspace = existing
    ? await db.workspace.update({ where: { id: existing.id }, data: { name: args.client } })
    : await db.workspace.create({ data: { name: args.client, slug: args.slug, plan: "scale" } })

  if (args.rera) {
    const settings = (workspace.settingsJson as Record<string, unknown> | null) ?? {}
    await db.workspace.update({
      where: { id: workspace.id },
      data: { settingsJson: { ...settings, rera: args.rera } },
    })
  }
  console.log(`   Workspace ${args.client} (${args.slug})${existing ? " — updated" : " — created"}`)

  await db.workspaceMember.upsert({
    where: { workspaceId_userId: { workspaceId: workspace.id, userId: owner.id } },
    update: { role: "OWNER" },
    create: { workspaceId: workspace.id, userId: owner.id, role: "OWNER" },
  })
  await ensureStages(workspace.id)
  console.log("   Pipeline Enquiry → Site Visit → Hold → Booking → Won / Lost")

  // ── Inventory ─────────────────────────────────────────────────────────────
  if (args.inventory) {
    const result = await importInventory(workspace.id, args.inventory)
    console.log(
      `   Inventory ${result.units} units across ${result.projects} project(s)${
        args.rera ? ` (RERA ${args.rera})` : ""
      }`
    )
  } else {
    console.log("   Inventory skipped (no --inventory)")
  }

  // ── Lead ingest ───────────────────────────────────────────────────────────
  //
  // Re-running this script to add a tower or correct a price must NOT rotate
  // the secret: that would silently invalidate a live customer's portal webhook
  // mid-pilot, and the failure looks like "our leads stopped arriving" rather
  // than "someone re-ran setup". Rotation is opt-in.
  const existingIngest = await getLeadIngestSettings(workspace.id)
  let secret: string | undefined
  let secretStatus: "minted" | "rotated" | "kept"

  if (!existingIngest.secretHash) {
    ;({ secret } = await createIngestSecret(workspace.id, owner.id))
    secretStatus = "minted"
  } else if (args.rotateSecret) {
    ;({ secret } = await createIngestSecret(workspace.id, owner.id))
    secretStatus = "rotated"
  } else {
    secretStatus = "kept"
  }

  console.log(
    secretStatus === "kept"
      ? "   Lead ingest secret unchanged (pass --rotate-secret to replace it)"
      : `   Lead ingest secret ${secretStatus} — webhook ingress is authenticated`
  )

  if (args.autoAck) {
    await setAutoAck(workspace.id, true, owner.id)
    console.log("   WhatsApp auto-ack ENABLED — brand-new leads will be messaged")
  } else {
    console.log("   WhatsApp auto-ack left OFF (default) — leads are captured but not messaged")
  }

  // ── Handoff ───────────────────────────────────────────────────────────────
  const webhook = `${base}/api/webhooks/leads/{source}?workspace=${args.slug}`
  const secretLine = secret
    ? `                header: x-estate360-ingest-key: ${secret}`
    : `                (unchanged — the stored secret still works. To replace it,\n                 re-run with --rotate-secret and update the portal first.)`

  console.log(`
────────────────────────────────────────────────────────────────
  HANDOFF — ${args.client}
────────────────────────────────────────────────────────────────
  Login         ${base}/login  (${args.ownerEmail})
  App           ${base}/${args.slug}
  Lead webhook  ${webhook}
${secretLine}
  Sources       meta · facebook · 99acres · magicbricks · magic_bricks ·
                housing · nobroker · google · website · pabbly
${secret ? "\n  Store the key in the portal's config now. It is kept only as a\n  hash — it cannot be shown again.\n" : ""}${args.autoAck ? "" : "\n  Auto-ack is OFF. Turn it on only after confirming the\n  customer's sources are ones where the enquirer gave their\n  number in good faith.\n"}
────────────────────────────────────────────────────────────────────────
`)
}

main()
  .catch((err) => {
    console.error("\nProvisioning failed:", err instanceof Error ? err.message : err)
    process.exit(1)
  })
  .finally(async () => {
    await db.$disconnect()
  })