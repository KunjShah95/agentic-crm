import { auth } from "@/lib/auth"
import LandingClient from "@/components/landing/landing-client"
import { MarketingChrome } from "@/components/landing/marketing-chrome"
import { pageMetadata } from "@/components/landing/site-config"
import { JsonLd } from "@/components/seo/json-ld"
import { graphLd } from "@/components/seo/structured-data"
import type { Metadata } from "next"

export const metadata: Metadata = pageMetadata({ path: "/" })

export default async function Home() {
  const session = await auth()
  const workspaceSlug = session?.workspaces?.[0]?.slug ?? null
  const isAuthed = !!session

  return (
    <MarketingChrome isAuthed={isAuthed} workspaceSlug={workspaceSlug} bare>
      {/*
        Organization, SoftwareApplication and FAQPage, generated from
        `content/marketing.ts`. The FAQ answers are the same strings rendered in
        the pricing page body, so the structured data and the visible copy cannot
        drift — the usual way a `FAQPage` node ends up quietly wrong.
      */}
      <JsonLd data={graphLd()} />
      <LandingClient workspaceSlug={workspaceSlug} isAuthed={isAuthed} />
    </MarketingChrome>
  )
}
