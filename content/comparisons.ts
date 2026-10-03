/**
 * Comparison copy — the highest-intent SEO queries a buyer types the week
 * before switching tools ("crm for builders in india vs excel").
 *
 * Each row is a claim we can defend: "them" describes what the category
 * genuinely does, "us" names the mechanism that replaces it. No trash talk —
 * a builder reading this wants a decision framework, not a fight.
 */

export type ComparisonRow = {
  /** The build-order question a buyer would ask. */
  question: string
  them: string
  us: string
}

export type Comparison = {
  slug: string
  competitor: string
  /** H1-adjacent positioning line. */
  verdict: string
  intro: string
  rows: ComparisonRow[]
}

export const COMPARISONS: Comparison[] = [
  {
    slug: "excel",
    competitor: "Excel + WhatsApp",
    verdict: "Keeps the unit inventory. Loses the audit trail.",
    intro:
      "Most Indian builders start with an Excel inventory and a WhatsApp group per project. It works until two people sell the same unit in different edits of the file. These are the points where the spreadsheet stops being a tool and starts being a risk.",
    rows: [
      {
        question: "Who changed unit A-1204's HOLD status, and when?",
        them: "Nobody knows. The last editor's change wins and the history is gone.",
        us: "Every stage change is logged as an activity with author, unit and cost sheet attached.",
      },
      {
        question: "What did the cost sheet quote before the discount?",
        them: "Overwritten in place. No history.",
        us: "Every cost sheet and stage change is an activity on the contact and deal timeline.",
      },
      {
        question: "Which milestone is overdue on the Singh booking?",
        them: "Found by scanning a collections sheet monthly.",
        us: "CLP milestones open automatically at booking; overdue ones surface on the morning Next Best Action list.",
      },
      {
        question: "Can broker A see broker B's allocations?",
        them: "Yes — the same file goes around on WhatsApp.",
        us: "Channel partners see only their allocated units; commissions live in a separate ledger.",
      },
      {
        question: "Did the site visit actually happen?",
        them: "A typed note in the sheet. Could be anywhere.",
        us: "GPS check-in required within 200m of the site, works offline, syncs later.",
      },
    ],
  },
  {
    slug: "generic-crm",
    competitor: "a generic CRM",
    verdict: "Models a deal as an amount and a stage. Real estate is a unit, a cost sheet, a schedule and a RERA number.",
    intro:
      "Horizontal CRMs are built around contacts, deals and tasks. A residential project sale needs an inventory hierarchy, construction-linked payments and RERA-compliant documents attached to the same record. Here is the gap, row by row.",
    rows: [
      {
        question: "Is the deal tied to a specific unit?",
        them: "Units get bolted on with a custom field; no tower/floor/unit stock.",
        us: "Project → Tower → Floor → Unit inventory is the native data model, importable from CSV.",
      },
      {
        question: "Does it generate demand letters with the RERA number?",
        them: "Templates by hand, every time; the registration number is typed in per letter.",
        us: "Demand notices, allotment letters and receipts are generated from shortcodes with the RERA number carried automatically.",
      },
      {
        question: "Can a payment plan follow construction milestones?",
        them: "Recurring invoices, yes. CLP-linked milestones with UPI reconciliation, no.",
        us: "Booking opens eight CLP milestones plus demand letter #1; UPI webhook reconciles collections.",
      },
      {
        question: "WhatsApp in Gujarati, Hindi and English?",
        them: "English-first inbox; regional templates are workarounds.",
        us: "Templates, buyer documents and public project sites render in the chosen language.",
      },
      {
        question: "Broker-scoped access and commissions?",
        them: "Permission per record at best; commission math lives in a spreadsheet.",
        us: "Role-scoped broker views, allocation filters and a commission ledger and referral queue in-workspace.",
      },
    ],
  },
]

export const COMPARISON_BY_SLUG: Record<string, Comparison> = Object.fromEntries(
  COMPARISONS.map((c) => [c.slug, c])
)
