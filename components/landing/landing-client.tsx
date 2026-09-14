import type { Metadata } from "next"
import { SiteHeader } from "@/components/landing/site-header"
import { SiteFooter } from "@/components/landing/sections/site-footer"
import { HeroSection } from "@/components/landing/sections/hero"
import { StorySection } from "@/components/landing/sections/story"
import { WorkflowsSection } from "@/components/landing/sections/workflows"
import { CommandBarSection } from "@/components/landing/sections/command-bar"
import { StaffSection } from "@/components/landing/sections/staff"
import { WinsSection } from "@/components/landing/sections/wins"
import { PricingSection } from "@/components/landing/sections/pricing"
import { ManifestoSection } from "@/components/landing/sections/manifesto"
import { pageMetadata } from "@/components/landing/site-config"

// Kept for IDE/discovery — the route page (app/(marketing)/page.tsx) owns the
// canonical <title>/<meta> used at render time. This export stays in sync so a
// component author sees the intended metadata here.
export const metadata: Metadata = {
  ...pageMetadata({
    title: "Real Estate CRM that tells your team what to do — Estate360",
    description:
      "Estate360 turns enquiries, WhatsApp, site visits, inventory, bookings and collections into one daily workflow. Morning brief, Next Best Action, lead temperature, at-risk deals, cost sheets in seconds.",
    path: "/",
  }),
  title: { absolute: "Estate360 — The daily operating system for real-estate sales" },
}

const base = "https://estate360.vercel.com"

const landingJsonLd = [
  {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "Estate360",
    applicationCategory: "BusinessApplication",
    operatingSystem: "Web",
    url: base,
    description:
      "The daily operating system for Indian real-estate sales: morning brief, Next Best Action, lead temperature, at-risk deals, property matching, WhatsApp-first workflow, cost sheets in seconds.",
    offers: { "@type": "Offer", price: "1499", priceCurrency: "INR" },
  },
  {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: [
      {
        "@type": "Question",
        name: "What is Estate360?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Estate360 is the daily operating system real-estate sales teams open every morning — it surfaces hot leads, at-risk deals, and today's site visits so the team knows exactly what to do next.",
        },
      },
      {
        "@type": "Question",
        name: "How does HOLD→BOOKING work?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Hold → KYC → confirm booking auto-creates 8 CLP milestones and demand letter #1. No Excel — every transition logs itself as an activity.",
        },
      },
      {
        "@type": "Question",
        name: "Is it workspace-scoped?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Yes. Every query filters by workspaceId. Brokers see only allocated inventory. Associations share a scoped pool.",
        },
      },
      {
        "@type": "Question",
        name: "Does it support Gujarati and Hindi?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Yes. WhatsApp templates, cost sheets, and public buyer sites render in en/gu/hi.",
        },
      },
    ],
  },
  {
    "@context": "https://schema.org",
    "@type": "HowTo",
    name: "How to run a booking in Estate360",
    step: [
      { "@type": "HowToStep", name: "Create project & units", text: "Project → Tower → Floor → Unit or CSV import 200 units." },
      { "@type": "HowToStep", name: "Cost sheet", text: "Base + GST + stamp + others → total in under 30 seconds." },
      { "@type": "HowToStep", name: "Book", text: "Hold → KYC → Booking creates 8 CLP milestones and demand letter #1." },
    ],
  },
]

type Props = { workspaceSlug?: string | null; isAuthed: boolean }

export default function Home({ workspaceSlug, isAuthed }: Props) {
  // session/auth state is resolved in the route page and passed down — see
  // app/(marketing)/page.tsx. This component is purely presentational.

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(landingJsonLd).replace(/</g, "\\u003c") }}
      />
      <div className="bg-background text-foreground">
        <SiteHeader isAuthed={isAuthed} workspaceSlug={workspaceSlug} />
        {/* ── Daily command center (hero) ── */}
        <HeroSection isAuthed={isAuthed} workspaceSlug={workspaceSlug} />
        {/* ── A day in Estate360 (story) ── */}
        <StorySection />
        {/* ── Work the product removes (benefit-led workflows) ── */}
        <WorkflowsSection />
        {/* ── Natural-language command bar ── */}
        <CommandBarSection />
        {/* ── One loop, every role ── */}
        <StaffSection />
        {/* ── Morning brief → wins → next day ── */}
        <WinsSection isAuthed={isAuthed} workspaceSlug={workspaceSlug} />
        {/* ── Pricing ── */}
        <PricingSection isAuthed={isAuthed} workspaceSlug={workspaceSlug} />
        {/* ── Why we built it ── */}
        <ManifestoSection isAuthed={isAuthed} workspaceSlug={workspaceSlug} />
        <SiteFooter isAuthed={isAuthed} workspaceSlug={workspaceSlug} />
      </div>
    </>
  )
}
