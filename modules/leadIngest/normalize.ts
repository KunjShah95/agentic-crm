/**
 * Normalize inbound lead payloads from portals (99acres/MagicBricks/Housing/
 * NoBroker/Meta/Google/Website) + enterprise connectors (Zapier/Pabbly/
 * IndiaMART/JustDial/HubSpot/Zoho/custom company slugs) into one shape.
 * Field names vary per portal; we probe a set of common aliases.
 *
 * Canonical source names come from `./sources` — the single registry shared
 * with the webhook route — so onboarding a new company never means editing
 * two maps that can drift.
 */

import { createHash } from "crypto"
import { canonicalSource } from "./sources"

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

const CONFIG_MAP: Record<string, string> = {
  "1bhk": "BHK1", "1 bhk": "BHK1", "1-bhk": "BHK1", "1_rk": "BHK1", "1rk": "BHK1",
  "2bhk": "BHK2", "2 bhk": "BHK2", "2-bhk": "BHK2",
  "3bhk": "BHK3", "3 bhk": "BHK3", "3-bhk": "BHK3",
  "4bhk": "BHK4", "4 bhk": "BHK4", "4-bhk": "BHK4",
  "5bhk": "BHK4", "5 bhk": "BHK4",
  villa: "VILLA", villas: "VILLA", bungalow: "VILLA",
  plot: "PLOT", plots: "PLOT", land: "PLOT", na_plot: "PLOT",
  shop: "SHOP", shops: "SHOP", retail: "SHOP",
  office: "OFFICE", offices: "OFFICE", commercial: "OFFICE",
}

function pick(obj: Record<string, unknown>, keys: string[]): string | undefined {
  for (const k of keys) {
    const v = obj[k]
    if (v !== undefined && v !== null && String(v).trim() !== "") return String(v).trim()
  }
  return undefined
}

function splitName(name?: string): { firstName: string; lastName: string } {
  return splitCompoundName(name)
}

function combineFirstLast(first?: string, last?: string): string | undefined {
  const f = (first ?? "").trim()
  const l = (last ?? "").trim()
  const joined = `${f} ${l}`.trim()
  return joined || undefined
}

function splitCompoundName(name?: string): { firstName: string; lastName: string } {
  if (!name) return { firstName: "Lead", lastName: "" }
  const parts = name.trim().split(/\s+/)
  return { firstName: parts[0], lastName: parts.slice(1).join(" ") }
}

/**
 * Enterprise wrappers: CRMs and iPaaS pipes (Zapier/Pabbly/Make) nest the
 * real fields one level deep — { lead: {...} }, { data: {...} },
 * { contact: {...} }, { form_response: {...} }. Unwrap one level when the
 * top level carries no recognized leaf keys itself.
 */
const WRAPPER_KEYS = ["lead", "data", "contact", "payload", "form_response", "formResponse", "body", "query", "record", "fields"]

const LEAF_KEYS = new Set([
  "name", "full_name", "fullName", "phone", "mobile", "email",
  "first_name", "firstName", "phoneNumber", "mobileNumber", "lead_id", "leadId",
])

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v)
}

function hasLeafKey(o: Record<string, unknown>): boolean {
  return Object.keys(o).some((k) => LEAF_KEYS.has(k))
}

function unwrapPayload(obj: Record<string, unknown>): Record<string, unknown> {
  if (hasLeafKey(obj)) return obj
  for (const key of WRAPPER_KEYS) {
    const inner = obj[key]
    if (isRecord(inner) && hasLeafKey(inner)) {
      // Merge: wrapper siblings (campaign, source ids) stay visible via raw,
      // but normalized fields come from the inner record.
      return { ...obj, ...inner }
    }
  }
  return obj
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

export function normalizeLead(
  source: string,
  payload: unknown,
  fieldMap?: Record<string, string>
): NormalizedLead {
  const obj = (payload && typeof payload === "object" ? payload : {}) as Record<string, unknown>
  // Unwrap common enterprise wrappers: { lead: {...} }, { data: {...} },
  // { form_response: {...} }, Zapier/Pabbly { query / body / data }.
  const o = unwrapPayload(obj)
  const src = canonicalSource(source)

  // Build alias lists: fieldMap overrides come first, then defaults.
  // The fieldMap maps canonical field names to source-specific keys,
  // e.g. { "name": "contact_name", "phone": "mobileNumber" }.
  const fm = fieldMap ?? {}
  const aliases = (canonical: string, defaults: string[]): string[] =>
    fm[canonical] ? [fm[canonical], ...defaults] : defaults

  // Enterprise field coverage: CRMs/aggregators use wildly different keys.
  // Order matters — first hit wins, so portal-specific keys come first.
  const name = pick(o, aliases("name", [
    "name", "full_name", "fullName", "customer_name", "lead_name",
    "contact_name", "contactName",
    "client_name", "buyer_name", "applicant_name",
  ]))
  const phone = pick(o, aliases("phone", [
    "phone", "mobile", "mobile_number", "phone_number", "contact", "contact_number",
    "phoneNumber", "mobileNumber", "contact_no", "contactNo", "phone_no",
    "customer_phone", "primary_phone", "whatsapp", "whatsapp_number",
  ]))
  const email = pick(o, aliases("email", ["email", "email_address", "emailAddress", "customer_email", "primary_email"]))
  const project = pick(o, aliases("project", [
    "project", "project_name", "projectName", "property", "listing",
    "property_name", "site_name", "campaign_name", "interested_project",
  ]))
  const configRaw = pick(o, aliases("config", [
    "config", "bhk", "unit_type", "unitType", "configuration",
    "property_type", "unit_config", "requirement", "bedrooms",
  ]))
  const locality = pick(o, aliases("locality", [
    "locality", "location", "area", "city",
    "preferred_location", "preferredLocation", "site_location", "zone",
  ]))
  const intent = pick(o, aliases("intent", ["intent", "purpose", "lead_type", "leadType", "enquiry_type", "interest_level"]))
  const budgetRaw = pick(o, aliases("budget", [
    "budget", "budget_range", "budgetRange", "price_range", "priceRange",
    "expected_budget", "max_budget", "price",
  ]))

  const externalId =
    pick(o, ["lead_id", "leadId", "id", "external_id", "externalId", "enquiry_id", "prospect_id", "record_id"]) ??
    createHash("sha1").update(`${src}:${phone ?? ""}:${email ?? ""}:${name ?? ""}`).digest("hex").slice(0, 16)

  // Name resolution: prefer a full name field, but also handle the common
  // CRM pattern of separate first_name / last_name keys. When both exist and
  // the "name" field only carries the first name, combine them so lastName
  // is not silently dropped.
  const firstNameRaw = pick(o, ["first_name", "firstName"])
  const lastNameRaw = pick(o, ["last_name", "lastName"])
  const fullName = name ?? combineFirstLast(firstNameRaw, lastNameRaw)
  const { firstName, lastName } = splitCompoundName(fullName)
  const config = configRaw ? CONFIG_MAP[configRaw.toLowerCase().trim()] : undefined
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
