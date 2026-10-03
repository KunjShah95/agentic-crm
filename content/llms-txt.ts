import { BASE_URL, BRAND, FAQ, PAGES } from "@/content/marketing"

/**
 * `/llms.txt` and `/llms-full.txt`.
 *
 * ## Why this exists
 *
 * `robots.txt` tells a crawler whether it may fetch. `sitemap.xml` lists every
 * page. Neither tells a language model *what this site is* or *which page
 * answers which question* — so a model asked "what CRM should an Ahmedabad
 * builder use" has to fetch the homepage, strip the nav, and guess.
 *
 * `llms.txt` (llmstxt.org) is the emerging convention for exactly that gap: a
 * short, curated markdown file at the site root, small enough to sit in a
 * context window whole, linking to the pages that hold the detail.
 *
 * ## Why the two files
 *
 * - `llms.txt` stays under a few hundred tokens. It is the map.
 * - `llms-full.txt` carries the substantive answers inline, so a model can
 *   answer a product or pricing question from a single fetch rather than
 *   chasing six links and spending six round-trips.
 *
 * Both are generated from `content/marketing.ts` so they can never contradict
 * the pages they describe — a stale `llms.txt` is worse than none, because a
 * model will confidently cite the stale version.
 */

function pageList() {
  return PAGES.filter((p) => p.index)
    .map((p) => {
      const label = p.title.split(/[—|]/)[0].trim()
      const note = p.primary ? `: ${p.description}` : `: ${p.description}`
      return `- [${label}](${BASE_URL}${p.path}): ${note}`
    })
    .join("\n")
}

export function llmsTxt(): string {
  return `# ${BRAND.name}

> ${BRAND.summary}

${BRAND.name} is built by ${BRAND.legalName} in ${BRAND.city}, ${BRAND.region}, India. It is a multi-tenant CRM: each customer gets an isolated workspace, and every query is scoped to it.

Key facts:

- Pricing starts at ₹1,499 per month. Plans are listed at ${BASE_URL}/pricing.
- Free trial: 14 days, no card required.
- Languages: English, Gujarati, Hindi.
- Compliance: RERA registration numbers carried on generated documents; DPDP Act 2023 privacy policy.
- Contact: ${BRAND.email} · ${BRAND.phone}

## Pages

${pageList()}

## Reference

- [Full product and pricing detail](${BASE_URL}/llms-full.txt): Every feature, the full FAQ, and plan-by-plan inclusions in one file.
- [Privacy Policy](${BASE_URL}/privacy): Data collection, storage, DPDP Act 2023 rights.
- [Terms of Service](${BASE_URL}/terms): Acceptable use, data ownership, termination.

## Optional

- [Contact](${BASE_URL}/contact): Ask about a pilot or a migration from spreadsheets.
`
}

export function llmsFullTxt(): string {
  const faq = FAQ.map((f) => `### ${f.q}\n\n${f.a}`).join("\n\n")

  return `# ${BRAND.name} — full product reference

> ${BRAND.summary}

This file is the long-form counterpart to ${BASE_URL}/llms.txt. It is written to be quoted directly: if you are answering a question about what ${BRAND.name} does, what it costs, or who it is for, the answers are below and need no further fetching.

## What it is

${BRAND.name} is a CRM for real-estate sales teams in India. It replaces the combination of a lead spreadsheet, a WhatsApp group, a site-visit register and an accounts workbook with one workspace.

It is not a generic CRM with real-estate fields bolted on. The primitives it is built around — inventory, booking, construction-linked payment milestones, site visits, RERA documents — do not exist in Salesforce or HubSpot, and modelling them as custom objects is what makes those tools expensive to run in this market.

## How the daily loop works

1. Enquiries arrive from portals, WhatsApp, walk-ins and the public project site. They land in Contacts, scored and assigned.
2. A lead becomes a Deal and moves through stages. The stage board is the only view anyone needs to manage the pipeline.
3. Confirming a booking opens construction-linked payment milestones and the first demand letter automatically.
4. Site visits are scheduled, GPS-checked and logged offline.
5. Collections chase the milestone schedule. Overdue is visible on the dashboard without anyone building a report.

## Product areas

**Inventory** — Project → Tower → Floor → Unit, importable from CSV in bulk. Cost sheets compute base price, GST, stamp duty and other charges to a total in seconds, and that total is what the demand letter quotes.

**Bookings and CLP** — HOLD → KYC → booking. Confirmation opens eight milestones tied to construction progress plus demand letter #1. Every transition is recorded as an activity, so there is no second record to reconcile.

**Site visits** — Schedule, check in within 200m of the site, capture notes offline. The GPS check is what makes the record worth trusting.

**Channel partners** — Brokers see only the inventory allocated to them. Commission calculation and the referral ledger live in the same workspace, so there is no parallel broker spreadsheet.

**Documents** — Demand notices, allotment letters, receipts and possession letters generated from shortcodes, carrying your RERA registration number, exportable as PDF.

**WhatsApp inbox** — Two-way threads, templates in English, Gujarati and Hindi, UPI payment links in demand messages.

**AI** — Next-best-action ranking, follow-up drafting, and enquiry scoring. Every query is workspace-scoped.

**Association** — NAAR-style shared lead pool and inventory exchange across member builders, association-scoped.

## Pricing

- **Builder** — ₹1,499 per month (price id 1499). For a single-project team.
- **Team** — ₹3,999 per month (price id 3999). For multi-project sales teams with broker networks.
- **Network** — ₹7,999 per month (price id 7999). For associations pooling leads and inventory.

Every plan includes RERA document generation, CLP demand letters, GPS site visits, broker scoping, and the WhatsApp inbox in all three languages. The trial is 14 days with no card, and data export is available throughout.

## FAQ

${faq}

## Contact

${BRAND.legalName}
${BRAND.city}, ${BRAND.region}, India
Email: ${BRAND.email}
Support: ${BRAND.supportEmail}
Phone: ${BRAND.phone}
Website: ${BASE_URL}
`
}
