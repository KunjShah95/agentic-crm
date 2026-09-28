/**
 * Keyword and copy source of truth for the marketing surface.
 *
 * Two reasons this is data rather than inline JSX:
 *
 * 1. **SEO/AEO/GEO.** Titles, descriptions, FAQ entries and keywords have to
 *    agree with each other and be readable in three places at once — the SERP,
 *    an LLM's answer, and the page itself. Keeping them here means the sitemap,
 *    the JSON-LD, and the rendered copy can never drift, which is the single
 *    most common way structured data ends up quietly wrong.
 *
 * 2. **Human voice.** Every string is short, specific, and free of the
 *    "revolutionise / empower / seamless / game-changing" register that makes a
 *    site read like it was written by a committee. If a line does not say
 *    something a builder could verify on Monday morning, it does not ship.
 *
 * Target terms are grouped by intent so each page owns one job. The
 * `primary` term is the page's reason to exist; `secondary` terms are
 * synonyms and long-tail the same page can honestly satisfy.
 */

export const BASE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://estate360.vercel.com"

export const BRAND = {
  name: "Estate360",
  legalName: "Estate360 Technologies Pvt. Ltd.",
  tagline: "The daily operating system for real-estate sales.",
  /** One sentence. Used as the llms.txt summary and the default meta description. */
  summary:
    "Estate360 is a CRM for Indian real-estate sales teams. It turns enquiries, WhatsApp conversations, site visits, inventory, bookings and collections into one daily workflow, and tells the team what to do next.",
  email: "hello@estate360.in",
  supportEmail: "support@estate360.in",
  phone: "+91 79 4890 2200",
  city: "Ahmedabad",
  region: "Gujarat",
  country: "IN",
  founded: "2024",
} as const

export type PageSpec = {
  path: string
  /** Raw title, no brand suffix — `pageMetadata` appends it. */
  title: string
  /** 140–160 chars. Written for a human skimming a SERP. */
  description: string
  /** The term this page exists to rank for. */
  primary: string
  secondary: string[]
  /** Indexing intent. Legal pages are indexed; thin utility pages are not. */
  index: boolean
  changefreq: "daily" | "weekly" | "monthly" | "yearly"
  priority: number
}

export const PAGES: PageSpec[] = [
  {
    path: "/",
    title: "Real Estate CRM for Indian Sales Teams — Estate360",
    description:
      "One CRM for enquiries, WhatsApp, site visits, inventory, bookings and collections. Built for Indian builders and sales teams. Start free, no card.",
    primary: "real estate crm",
    secondary: [
      "property sales crm",
      "real estate lead management",
      "real estate sales software india",
      "builder crm",
    ],
    index: true,
    changefreq: "weekly",
    priority: 1,
  },
  {
    path: "/product",
    title: "Product — Inventory, Bookings, Site Visits, WhatsApp | Estate360",
    description:
      "Inventory, cost sheets, CLP milestones, GPS site visits, broker scoping, RERA documents and a WhatsApp inbox in Gujarati, Hindi and English.",
    primary: "real estate crm features",
    secondary: [
      "inventory management software",
      "cost sheet software",
      "site visit tracking app",
      "real estate workflow automation",
    ],
    index: true,
    changefreq: "weekly",
    priority: 0.9,
  },
  {
    path: "/pricing",
    title: "Pricing — Plans from ₹1,499/month | Estate360",
    description:
      "Straightforward pricing for Indian real-estate teams. Every plan includes RERA documents, CLP demand letters, GPS site visits and WhatsApp.",
    primary: "real estate crm pricing",
    secondary: [
      "crm pricing india",
      "real estate software cost",
      "property management software pricing",
    ],
    index: true,
    changefreq: "weekly",
    priority: 0.9,
  },
  {
    path: "/contact",
    title: "Contact — Talk to the Estate360 Team",
    description:
      "Questions about Estate360, pricing, or a pilot for your sales team? Reach us on WhatsApp, email, or phone. We reply within one working day.",
    primary: "contact estate360",
    secondary: ["real estate crm demo", "book a crm demo"],
    index: true,
    changefreq: "monthly",
    priority: 0.7,
  },
  {
    path: "/privacy",
    // Brand in the title even on legal pages: a SERP that reads bare
    // "Privacy Policy" looks like a template, and legal pages are the ones a
    // buyer checks before handing over a customer list.
    title: "Privacy Policy | Estate360",
    description:
      "How Estate360 collects, uses, stores and deletes personal data, including DPDP Act 2023 rights and where your data is stored.",
    primary: "",
    secondary: [],
    index: true,
    changefreq: "yearly",
    priority: 0.2,
  },
  {
    path: "/terms",
    title: "Terms of Service | Estate360",
    description:
      "The terms governing your use of Estate360, including acceptable use, data ownership, subscriptions, and termination.",
    primary: "",
    secondary: [],
    index: true,
    changefreq: "yearly",
    priority: 0.2,
  },
  {
    path: "/thank-you",
    // Kept in the spec rather than hand-written at the route, so the title and
    // robots decision sit together with every other page's indexing intent.
    title: "Thanks — we'll be in touch | Estate360",
    description:
      "Thanks for contacting Estate360. Our Ahmedabad team replies within one working day, Monday to Saturday, 10:00–19:00 IST.",
    primary: "",
    secondary: [],
    // A confirmation page with no content of its own. Indexing it is a thin-
    // content signal with zero upside, and it should never appear in a SERP.
    index: false,
    changefreq: "yearly",
    priority: 0.1,
  },
  {
    path: "/signup",
    title: "Start Free — 14-Day Trial | Estate360",
    description:
      "Create your workspace and start tracking leads, inventory and bookings. Fourteen days free, no card required, export your data any time.",
    primary: "real estate crm free trial",
    secondary: ["try real estate crm"],
    index: true,
    changefreq: "monthly",
    priority: 0.8,
  },
]

export const PAGE_BY_PATH: Record<string, PageSpec> = Object.fromEntries(
  PAGES.map((p) => [p.path, p])
)

/**
 * FAQ entries.
 *
 * These are the questions a buyer actually asks in a first call. They are
 * written as answers, not as marketing copy, because the whole point of
 * `FAQPage` structured data is that a model may quote the answer verbatim —
 * so an evasive answer here becomes an evasive answer in an AI summary.
 */
export const FAQ = [
  {
    q: "What is Estate360?",
    a: "Estate360 is a CRM for real-estate sales teams in India. It puts enquiries, WhatsApp conversations, site visits, inventory, bookings and collections in one place, and opens each morning with a ranked list of what the team should do next.",
  },
  {
    q: "Who is it built for?",
    a: "Builders and sales teams running one or more residential or commercial projects. The same workspace serves owners, sales staff, channel partners, site engineers and accounts — each sees only what their role needs.",
  },
  {
    q: "How does a booking become a payment schedule?",
    a: "When a HOLD is confirmed and KYC is done, Estate360 creates the booking and opens eight construction-linked payment milestones plus the first demand letter. Every stage change is logged as an activity, so nothing has to be reconciled from a spreadsheet.",
  },
  {
    q: "Can a broker see our whole inventory?",
    a: "No. Channel partners see only the units allocated to them. Commission calculations and the referral ledger stay inside the same workspace, so there is no separate broker spreadsheet to reconcile.",
  },
  {
    q: "Does it handle RERA documentation?",
    a: "Yes. Demand notices, allotment letters, receipts and possession letters are generated from shortcodes and carry your RERA registration number, and export as PDF whenever an auditor asks.",
  },
  {
    q: "Which languages does the WhatsApp inbox support?",
    a: "English, Gujarati and Hindi. Templates, buyer-facing documents and the public project site all render in the language you choose, and UPI payment links can be embedded in demand messages.",
  },
  {
    q: "How do you keep one broker's data away from another's?",
    a: "Every query is scoped to a workspace. Membership is checked on the server for every request, not just at the route level, so a logged-in user from one tenant cannot read another tenant's contacts by editing a URL.",
  },
  {
    q: "What happens to my data if I leave?",
    a: "It is yours. Export contacts, deals, and inventory as CSV whenever you want, and cancelling does not delete your workspace without an explicit request from you.",
  },
  {
    q: "How long does setup take?",
    a: "A single team can be running the same afternoon: create a workspace, import your inventory from CSV, and start adding leads. A multi-project rollout with broker onboarding usually takes a week.",
  },
  {
    q: "Is there a free trial?",
    a: "Fourteen days, no card required. The trial is a real workspace, not a read-only demo, and you can export your data at any point during it.",
  },
] as const
