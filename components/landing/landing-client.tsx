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

/*
 * The landing page, in the order a buyer should meet it.
 *
 *   Hero       what it is, in one line
 *   Story      what a day looks like — the part a generic CRM cannot show
 *   Workflows  which work the product removes
 *   Command    how you talk to it
 *   Staff      one loop, every role
 *   Wins       the morning brief, and the honesty about sample data
 *   Pricing    what it costs
 *   Manifesto  why it was built
 *
 * Purely presentational: auth state and the JSON-LD graph are resolved in the
 * route page and passed in, so this file contains no logic worth testing.
 */

type Props = { workspaceSlug?: string | null; isAuthed: boolean }

export default function Home({ workspaceSlug, isAuthed }: Props) {
  return (
    <div className="bg-background text-foreground">
      <SiteHeader isAuthed={isAuthed} workspaceSlug={workspaceSlug} />
      <HeroSection isAuthed={isAuthed} workspaceSlug={workspaceSlug} />
      <StorySection />
      <WorkflowsSection />
      <CommandBarSection />
      <StaffSection />
      <WinsSection isAuthed={isAuthed} workspaceSlug={workspaceSlug} />
      <PricingSection isAuthed={isAuthed} workspaceSlug={workspaceSlug} />
      <ManifestoSection isAuthed={isAuthed} workspaceSlug={workspaceSlug} />
      <SiteFooter isAuthed={isAuthed} workspaceSlug={workspaceSlug} />
    </div>
  )
}
