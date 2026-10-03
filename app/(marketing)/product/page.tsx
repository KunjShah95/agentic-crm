import type { Metadata } from "next"
import Link from "next/link"
import { auth } from "@/lib/auth"
import { MarketingChrome } from "@/components/landing/marketing-chrome"
import { PageHero } from "@/components/landing/page-hero"
import { StaffSection } from "@/components/landing/sections/staff"
import { pageMetadata } from "@/components/landing/site-config"
import { JsonLd } from "@/components/seo/json-ld"
import { breadcrumbLd } from "@/components/seo/structured-data"
import { Button } from "@/components/ui/button"
import {
  Building2,
  FileCheck,
  Handshake,
  MapPin,
  MessageSquare,
  Navigation,
  Sparkles,
  Workflow,
} from "lucide-react"

/*
 * Copy rules for this page, applied to every line below:
 *
 * - Lead with the mechanism, not the benefit. "Confirming a booking opens eight
 *   payment milestones" is checkable on Monday; "streamlines your collections"
 *   is not, and a builder has heard it before.
 * - One claim per sentence. Comma-spliced feature lists are what make a product
 *   page unreadable, and unreadable pages do not convert.
 * - Name the constraint you remove. "Within 200m" is a real product decision
 *   with a real consequence; "smart location tracking" is neither.
 */
const CAPABILITIES = [
  {
    icon: Building2,
    title: "Inventory that matches the site",
    body: "Project → Tower → Floor → Unit, importable from CSV in bulk. Cost sheets total base price, GST, stamp duty and other charges in under 30 seconds — and that total is what the demand letter quotes, so the two can never disagree.",
  },
  {
    icon: Workflow,
    title: "HOLD → KYC → booking, then it writes itself",
    body: "Confirming a booking opens eight construction-linked payment milestones plus demand letter #1. Every stage change is logged as an activity, so the milestone schedule never has to be rebuilt from a spreadsheet.",
  },
  {
    icon: Navigation,
    title: "Site visits that prove they happened",
    body: "Schedule a visit, check in within 200m of the site, capture notes offline. The GPS check is the point: without it, a visit log is a claim rather than a record.",
  },
  {
    icon: Handshake,
    title: "Brokers see their units, not your inventory",
    body: "Channel partners get an allocation-scoped view. Commission calculation and the referral ledger stay in the same workspace, which removes the parallel broker spreadsheet entirely.",
  },
  {
    icon: FileCheck,
    title: "RERA-ready documents",
    body: "Demand notices, allotment letters, receipts and possession letters generated from shortcodes, each carrying your RERA registration number. Export as PDF whenever the auditor asks — the data is yours.",
  },
  {
    icon: MessageSquare,
    title: "WhatsApp inbox in Gujarati, Hindi and English",
    body: "Two-way threads with templated replies and UPI payment links inside demand messages. Most collections follow-ups in this market happen on WhatsApp, so it belongs in the CRM rather than beside it.",
  },
  {
    icon: Sparkles,
    title: "AI that ranks, not decorates",
    body: "Next-best-action ordering, follow-up drafting, and enquiry scoring. Every query is workspace-scoped, so the ranking is based on your pipeline and nobody else's.",
  },
  {
    icon: MapPin,
    title: "Association lead pool",
    body: "NAAR-style shared leads and inventory exchange across member builders. One member claims a lead, both see the audit trail, and your units appear in the association grid.",
  },
]

export const metadata: Metadata = pageMetadata({ path: "/product" })

export default async function ProductPage() {
  const session = await auth()
  const workspaceSlug = session?.workspaces?.[0]?.slug ?? null
  const isAuthed = !!session
  const cta = isAuthed && workspaceSlug ? `/${workspaceSlug}/contacts` : "/signup"

  return (
    <MarketingChrome isAuthed={isAuthed} workspaceSlug={workspaceSlug}>
      <JsonLd
        data={breadcrumbLd([
          { name: "Home", path: "/" },
          { name: "Product", path: "/product" },
        ])}
      />

      <PageHero
        title={
          <>
            One loop for owners, sales,
            <br className="hidden sm:block" /> brokers, site and accounts.
          </>
        }
        description="Everything that used to live in a spreadsheet, a WhatsApp group and a broker's notebook — in one workspace, with an audit trail."
        primaryCta={{ href: cta, label: isAuthed ? "Open workspace" : "Start free" }}
        secondaryCta={{ href: "/pricing", label: "See pricing" }}
      />

      <section className="mx-auto max-w-[1280px] px-6 py-14 lg:px-8">
        <div className="grid items-center gap-10 lg:grid-cols-2">
          <div>
            <span className="text-[11px] tracking-[0.12em] text-muted-foreground">
              BUILT FOR INDIAN PROJECTS
            </span>
            <h2 className="mt-3 text-[28px] font-semibold tracking-[-0.02em] sm:text-[34px]">
              Made for how a project is actually sold.
            </h2>
            <p className="mt-3 max-w-[480px] text-[15px] leading-6 text-muted-foreground">
              Most CRMs model a deal as an amount and a stage. A residential
              project needs the unit, the cost sheet, the construction-linked
              payment schedule and the RERA number attached to the same record.
              That is the model here.
            </p>
            <ul className="mt-5 space-y-2 text-[14px] text-muted-foreground">
              {[
                "Every query is workspace-isolated",
                "Broker views are allocation-scoped",
                "Handover happens on a schedule, not a promise",
              ].map((point) => (
                <li key={point} className="flex items-start gap-2.5">
                  <span
                    aria-hidden
                    className="mt-[7px] size-1.5 shrink-0 rounded-full bg-brand"
                  />
                  {point}
                </li>
              ))}
            </ul>
          </div>
          <div className="relative overflow-hidden rounded-md border bg-card shadow-e3">
            {/* eslint-disable-next-line @next/next/no-img-element -- compressed SVG asset, pre-sized at 960x540 so the grid does not shift on load */}
            <img
              src="/images/product-pipeline.svg"
              alt="Estate360 pipeline showing the Lead, Qualified and Closing stages for a residential project in Ahmedabad"
              width={960}
              height={540}
              className="h-auto w-full"
              decoding="async"
            />
          </div>
        </div>

        <div className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {CAPABILITIES.map((c) => (
            <article
              key={c.title}
              /* Border-only hover. These cards are not links, so the lift that
                 the clickable cards elsewhere in the app use would be a lie —
                 it promises an action there is none of. The border step is
                 enough to lift them off the row without pretending. */
              className="rounded-md border bg-card p-4 transition-colors duration-200 hover:border-foreground/20"
            >
              <span className="inline-flex size-8 items-center justify-center rounded-sm bg-foreground text-background">
                <c.icon className="size-4" aria-hidden />
              </span>
              <h3 className="mt-3 text-[14px] font-semibold tracking-[-0.01em]">
                {c.title}
              </h3>
              <p className="mt-1.5 text-[13px] leading-5 text-muted-foreground">{c.body}</p>
            </article>
          ))}
        </div>
      </section>

      <StaffSection />

      <section className="mx-auto max-w-[720px] px-6 py-14 text-center lg:px-8">
        <h2 className="text-[28px] font-semibold tracking-[-0.02em]">
          Try it on your own data.
        </h2>
        <p className="mt-3 text-muted-foreground">
          Fourteen days, no card. Import a real project and see whether the
          pipeline holds up.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Button
            variant="brand"
            size="lg"
            className="h-11 px-7"
            render={<Link href={cta} />}
          >
            {isAuthed ? "Open workspace" : "Start free"}
          </Button>
          <Button
            variant="outline"
            size="lg"
            className="h-11 px-6"
            render={<Link href="/contact" />}
          >
            Talk to sales
          </Button>
        </div>
      </section>
    </MarketingChrome>
  )
}
