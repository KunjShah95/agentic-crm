import { auth } from "@/lib/auth"
import { LandingClient } from "@/components/landing/landing-client"
import { MarketingChrome } from "@/components/landing/marketing-chrome"
import { pageMetadata } from "@/components/landing/site-config"
import type { Metadata } from "next"

export const metadata: Metadata = {
  ...pageMetadata({
    title: "Multi-tenant CRM for founders & sales teams",
    description:
      "Real Estate + generic CRM for NAAR/Gujarat: inventory, HOLD→BOOKING→CLP, GPS site visits, broker scope, RERA docs, WhatsApp inbox, AI, reports, public sites + buyer portal, and association shared pool.",
    path: "/",
  }),
  title: {
    absolute: "Estate360 — Multi-tenant CRM for founders & sales teams",
  },
}

export default async function Home() {
  const session = await auth()
  const workspaceSlug = session?.workspaces?.[0]?.slug ?? null
  const isAuthed = !!session

  return (
    <MarketingChrome isAuthed={isAuthed} workspaceSlug={workspaceSlug} bare>
      <LandingClient workspaceSlug={workspaceSlug} isAuthed={isAuthed} />
    </MarketingChrome>
  )
}
