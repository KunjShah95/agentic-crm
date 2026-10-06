/**
 * Enterprise lead-source registry — the onboarding surface for leads coming
 * from OTHER companies (portals, aggregators, CRMs, Zapier/Pabbly pipes).
 *
 * Before this module the set of accepted `[source]` slugs lived inline in
 * `app/api/webhooks/leads/[source]/route.ts` as a hardcoded Set, and the
 * canonical name mapping lived in `modules/leadIngest/normalize.ts` as
 * SOURCE_MAP. The two could drift (a slug accepted by the route but mapped
 * to WEBSITE by normalize, or vice versa), and onboarding a new partner
 * meant editing two files.
 *
 * This is the single source of truth both import. Rules:
 * - `KNOWN_SLUGS` = slugs the webhook route accepts (URL-level).
 * - `canonicalSource(slug)` = display/storage name written to
 *   Contact.leadSource + WebhookEvent.source. Known portals keep their
 *   canonical names; anything matching the generic slug shape
 *   `[a-z0-9][a-z0-9_-]{1,40}` is accepted as an ENTERPRISE source and
 *   uppercased (`acme-crm` -> `ACME_CRM`), so a new company onboards with
 *   zero code change — mint a secret, point their webhook at
 *   `/api/webhooks/leads/<their-slug>?workspace=<slug>`, done.
 * - Anything else (empty, path traversal, absurd length) is rejected so the
 *   route can 400 before touching the DB.
 */

const CANONICAL_MAP: Record<string, string> = {
  ninety_nine_acres: "NINETY_NINE_ACRES",
  "99acres": "NINETY_NINE_ACRES",
  magic_bricks: "MAGIC_BRICKS",
  magicbricks: "MAGIC_BRICKS",
  housing: "HOUSING",
  nobroker: "NOBROKER",
  no_broker: "NOBROKER",
  meta: "META",
  facebook: "META",
  instagram: "META",
  google: "GOOGLE",
  website: "WEBSITE",
  walk_in: "WALK_IN",
  walkin: "WALK_IN",
  pabbly: "PABBLY",
  zapier: "ZAPIER",
  indiamart: "INDIAMART",
  justdial: "JUSTDIAL",
  hubspot: "HUBSPOT",
  salesforce: "SALESFORCE",
  zoho: "ZOHO",
  oracle_cx: "ORACLE_CX",
  oraclecx: "ORACLE_CX",
}

export const KNOWN_SLUGS: ReadonlySet<string> = new Set(Object.keys(CANONICAL_MAP))

const GENERIC_SLUG_RE = /^[a-z0-9][a-z0-9_-]{1,40}$/

export function normalizeSlug(raw: unknown): string {
  return String(raw ?? "").toLowerCase().trim()
}

/** True when the route should accept this slug at all. */
export function isAcceptedSourceSlug(raw: unknown): boolean {
  const slug = normalizeSlug(raw)
  if (KNOWN_SLUGS.has(slug)) return true
  return GENERIC_SLUG_RE.test(slug)
}

/**
 * Canonical storage name for a slug. Known portals map to their stable
 * names; any other well-formed slug uppercases into an ENTERPRISE name
 * (`acme-crm` -> `ACME_CRM`). Malformed input falls back to WEBSITE so
 * normalizeLead() never throws on hostile input.
 */
export function canonicalSource(raw: unknown): string {
  const slug = normalizeSlug(raw)
  const known = CANONICAL_MAP[slug]
  if (known) return known
  if (GENERIC_SLUG_RE.test(slug)) {
    return slug.replace(/-/g, "_").toUpperCase()
  }
  return "WEBSITE"
}

/** Slugs shown in the settings UI as first-class examples. */
export function exampleSlugs(): string[] {
  return [
    "meta",
    "99acres",
    "magicbricks",
    "housing",
    "nobroker",
    "google",
    "website",
    "pabbly",
    "zapier",
    "indiamart",
    "<your-company-slug>",
  ]
}
