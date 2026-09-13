import type { Metadata } from "next"
import { auth } from "@/lib/auth"
import { MarketingChrome } from "@/components/landing/marketing-chrome"
import { PageHero } from "@/components/landing/page-hero"
import { StaffSection } from "@/components/landing/sections/staff"
import { pageMetadata } from "@/components/landing/site-config"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
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

export const metadata: Metadata = pageMetadata({
  title: "Product",
  description:
    "The complete Real Estate CRM for builders: inventory management, instant cost sheets, CLP booking milestones, GPS site visits, broker scoping, RERA automation, and WhatsApp integration.",
  path: "/product",
})

const CAPABILITIES = [
  {
    icon: Building2,
    title: "Inventory that matches the site",
    body: "Project → Tower → Floor → Unit. CSV import 200 units. Cost sheet with GST, stamp, and others in under 30 seconds.",
  },
  {
    icon: Workflow,
    title: "HOLD → BOOKING → CLP",
    body: "Confirm booking and Estate360 opens 8 CLP milestones plus demand letter #1. Every stage change is Activity — no Excel leak.",
  },
  {
    icon: Navigation,
    title: "GPS site visits",
    body: "Schedule, check in within 200m, offline field notes. Fake visits die; Site Engineers actually show up on the plot.",
  },
  {
    icon: Handshake,
    title: "Broker-scoped inventory",
    body: "Channel partners see only allocated units. Commission math and referral ledger stay inside the same workspace.",
  },
  {
    icon: FileCheck,
    title: "RERA-ready documents",
    body: "Shortcodes, allotment, demand letters with {{rera_no}}. Export when the auditor asks — your data, your possession letter.",
  },
  {
    icon: MessageSquare,
    title: "WhatsApp inbox · gu / hi / en",
    body: "Two-way threads, templates in Gujarati and Hindi, UPI links in demand messages. Collections before the 7th.",
  },
  {
    icon: Sparkles,
    title: "AI next-best-action",
    body: "Ask the pipeline, draft follow-ups, score enquiries from public sites — always filtered by workspaceId.",
  },
  {
    icon: MapPin,
    title: "NAAR association pool",
    body: "Shared leads and listings across member builders. Slug-routed workspaces; association-scoped exchange.",
  },
]

export default async function ProductPage() {
  const session = await auth()
  const workspaceSlug = session?.workspaces?.[0]?.slug ?? null
  const isAuthed = !!session
  const cta = isAuthed && workspaceSlug ? `/${workspaceSlug}/contacts` : "/signup"

  return (
    <MarketingChrome isAuthed={isAuthed} workspaceSlug={workspaceSlug}>
      <PageHero
        eyebrow="PRODUCT · REAL ESTATE NA CRM"
        title={
          <>
            One loop for Owners, Sales,
            <br className="hidden sm:block" /> Brokers, Site & Accounts.
          </>
        }
        description="Everything that used to live in Excel, WhatsApp groups, and broker notebooks — workspace-scoped, audited, and built for SG Highway to South Bopal."
        primaryCta={{ href: cta, label: isAuthed ? "Open workspace" : "Start free in 30 seconds" }}
        secondaryCta={{ href: "/pricing", label: "See pricing" }}
      />

      <section className="mx-auto max-w-[1280px] px-6 py-14 lg:px-8">
        <div className="grid items-center gap-10 lg:grid-cols-2">
          <div>
            <Badge variant="outline" className="rounded-full font-mono text-[11px] tracking-[0.12em]">
              LIVE SPECIMEN
            </Badge>
            <h2 className="mt-3 text-[28px] font-semibold tracking-[-0.02em] sm:text-[34px]">
              Built where Ahmedabad builds.
            </h2>
            <p className="mt-3 max-w-[480px] text-[15px] leading-6 text-muted-foreground">
              Estate360 is built specifically for real estate developers and sales teams running multiple projects.
              Every query is workspace-isolated, and brokers only see their allocated inventory.
            </p>
          </div>
          <div className="relative overflow-hidden rounded-[20px] border bg-card shadow-[0_24px_60px_-16px_rgba(23,18,10,0.18)]">
            {/* eslint-disable-next-line @next/next/no-img-element -- compressed SVG asset */}
            <img
              src="/images/product-pipeline.svg"
              alt="Estate360 pipeline illustration showing Lead, Qualified, and Closing stages for an Ahmedabad residential project"
              width={960}
              height={540}
              className="h-auto w-full"
              decoding="async"
            />
          </div>
        </div>

        <div className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {CAPABILITIES.map((c) => (
            <Card key={c.title} className="border-border/60 transition-transform hover:-translate-y-0.5">
              <CardHeader className="pb-2">
                <span className="inline-flex size-8 items-center justify-center rounded-lg bg-foreground text-background">
                  <c.icon className="size-4" aria-hidden />
                </span>
                <CardTitle className="text-[14px] tracking-tight">{c.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription className="text-[13px] leading-5">{c.body}</CardDescription>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <StaffSection />

      <section className="mx-auto max-w-[720px] px-6 py-14 text-center lg:px-8">
        <h2 className="text-[28px] font-semibold tracking-[-0.02em]">Ready to close the loop?</h2>
        <p className="mt-3 text-muted-foreground">14-day trial. No card. Demo workspace /acme with Shilp Infra data.</p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <a
            href={cta}
            className="inline-flex h-11 items-center justify-center rounded-full bg-primary px-7 text-sm font-medium text-primary-foreground"
          >
            {isAuthed ? "Open workspace" : "Start free"}
          </a>
          <a
            href="/contact"
            className="inline-flex h-11 items-center justify-center rounded-full border bg-card px-6 text-sm font-medium"
          >
            Talk to sales
          </a>
        </div>
      </section>
    </MarketingChrome>
  )
}
