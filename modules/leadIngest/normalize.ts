/**
 * Normalize inbound lead payloads from portals (99acres/MagicBricks/Housing/
 * NoBroker/Meta/Google/Website) + generic Pabbly into one shape.
 * Field names vary per portal; we probe a set of common aliases.
 */

import { createHash } from "crypto"

export type NormalizedLead = {
  externalId: string
  dedupeKey: string
  firstName: string
  lastName: string
  phone?: string
  email?: string
  source: string
  project?: string
  config?: string
  locality?: string
  intent?: string
  budgetMin?: number
  budgetMax?: number
  raw: Record<string, unknown>
}

const SOURCE_MAP: Record<string, string> = {
  ninety_nine_acres: "NINETY_NINE_ACRES",
  "99acres": "NINETY_NINE_ACRES",
  magic_bricks: "MAGIC_BRICKS",
  magicbricks: "MAGIC_BRICKS",
  housing: "HOUSING",
  nobroker: "NOBROKER",
  meta: "META",
  facebook: "META",
  google: "GOOGLE",
  website: "WEBSITE",
  walk_in: "WALK_IN",
  pabbly: "PABBLY",
}

const CONFIG_MAP: Record<string, string> = {
  "1bhk": "BHK1", "1 bhk": "BHK1",
  "2bhk": "BHK2", "2 bhk": "BHK2",
  "3bhk": "BHK3", "3 bhk": "BHK3",
  "4bhk": "BHK4", "4 bhk": "BHK4",
  villa: "VILLA", plot: "PLOT", shop: "SHOP", office: "OFFICE",
}

function pick(o: Record<string, unknown>, keys: string[]): string | undefined {
  for (const k of keys) {
    const v = o[k]
    if (v !== undefined && v !== null && String(v).trim() !== "") return String(v).trim()
  }
  return undefined
}

function splitName(name?: string): { firstName: string; lastName: string } {
  if (!name) return { firstName: "Lead", lastName: "" }
  const parts = name.trim().split(/\s+/)
  return { firstName: parts[0], lastName: parts.slice(1).join(" ") }
}

/** Parse "80-90 Lakh" / "1.2 Cr" style budget strings into rupee min/max. */
export function parseBudget(s?: string): { budgetMin?: number; budgetMax?: number } {
  if (!s) return {}
  const lower = s.toLowerCase()
  const mult = lower.includes("cr") ? 1e7 : lower.includes("lakh") || lower.includes("lac") ? 1e5 : 1
  const nums = (lower.match(/[\d.]+/g) ?? []).map((n) => parseFloat(n) * mult).filter((n) => Number.isFinite(n))
  if (!nums.length) return {}
  return { budgetMin: Math.min(...nums), budgetMax: Math.max(...nums) }
}

export function normalizeLead(source: string, payload: unknown): NormalizedLead {
  const o = (payload && typeof payload === "object" ? payload : {}) as Record<string, unknown>
  const src = SOURCE_MAP[source.toLowerCase().trim()] ?? "WEBSITE"

  const name = pick(o, ["name", "full_name", "fullName", "customer_name", "lead_name"])
  const phone = pick(o, ["phone", "mobile", "mobile_number", "phone_number", "contact", "contact_number"])
  const email = pick(o, ["email", "email_address"])
  const project = pick(o, ["project", "project_name", "property", "listing"])
  const configRaw = pick(o, ["config", "bhk", "unit_type", "configuration"])
  const locality = pick(o, ["locality", "location", "area", "city"])
  const intent = pick(o, ["intent", "purpose", "lead_type"])
  const budgetRaw = pick(o, ["budget", "budget_range", "price_range"])

  const externalId =
    pick(o, ["lead_id", "leadId", "id", "external_id"]) ??
    createHash("sha1").update(`${src}:${phone ?? ""}:${email ?? ""}:${name ?? ""}`).digest("hex").slice(0, 16)

  const { firstName, lastName } = splitName(name)
  const config = configRaw ? CONFIG_MAP[configRaw.toLowerCase()] : undefined
  const { budgetMin, budgetMax } = parseBudget(budgetRaw)

  return {
    externalId,
    dedupeKey: `${src}:${externalId}`,
    firstName,
    lastName,
    phone,
    email,
    source: src,
    project,
    config,
    locality,
    intent,
    budgetMin,
    budgetMax,
    raw: o,
  }
}
