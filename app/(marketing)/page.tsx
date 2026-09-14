import { auth } from "@/lib/auth"
import LandingClient from "@/components/landing/landing-client"
import { MarketingChrome } from "@/components/landing/marketing-chrome"
import { pageMetadata } from "@/components/landing/site-config"
import type { Metadata } from "next"

export const metadata: Metadata = {
  ...pageMetadata({
    title: "Daily operating system for real-estate sales — Estate360",
    description:
      "Estate360 turns enquiries, WhatsApp conversations, site visits, inventory, bookings and collections into one daily workflow for Indian real-estate teams. Open it — know exactly what to do next.",
    path: "/",
  }),
  title: {
    absolute: "Estate360 — The daily operating system for real-estate sales",
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
