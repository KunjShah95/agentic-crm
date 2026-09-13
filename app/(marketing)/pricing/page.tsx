import type { Metadata } from "next"
import { auth } from "@/lib/auth"
import { MarketingChrome } from "@/components/landing/marketing-chrome"
import { PageHero } from "@/components/landing/page-hero"
import { PricingSection } from "@/components/landing/sections/pricing"
import { pageMetadata } from "@/components/landing/site-config"

export const metadata: Metadata = pageMetadata({
  title: "Pricing",
  description:
    "Estate360 pricing for Ahmedabad builders: Builder ₹1,499, Team ₹3,999, Network ₹7,999. RERA, CLP, GPS, WhatsApp gu/hi included. 14-day free trial.",
  path: "/pricing",
})

export default async function PricingPage() {
  const session = await auth()
  const workspaceSlug = session?.workspaces?.[0]?.slug ?? null
  const isAuthed = !!session

  return (
    <MarketingChrome isAuthed={isAuthed} workspaceSlug={workspaceSlug}>
      <PageHero
        eyebrow="PRICING · FOR AHMEDABAD BUILDERS"
        title="Priced for site, not seat tricks."
        description="All plans include RERA shortcodes, CLP demand letters, GPS site visits, broker scope, and WhatsApp gu/hi. Cancel anytime — export your data."
        primaryCta={{
          href: isAuthed && workspaceSlug ? `/${workspaceSlug}/contacts` : "/signup",
          label: isAuthed ? "Open workspace" : "Start 14-day free trial",
        }}
        secondaryCta={{ href: "/contact", label: "Ask about Network" }}
      />
      <PricingSection isAuthed={isAuthed} workspaceSlug={workspaceSlug} />
    </MarketingChrome>
  )
}
