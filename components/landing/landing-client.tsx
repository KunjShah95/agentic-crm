import { SiteHeader } from "@/components/landing/site-header"
import { SiteFooter } from "@/components/landing/sections/site-footer"
import { HeroSection } from "@/components/landing/sections/hero"
import { StorySection } from "@/components/landing/sections/story"
import { WorkflowsSection } from "@/components/landing/sections/workflows"
import { InventorySection } from "@/components/landing/sections/inventory"
import { CommandBarSection } from "@/components/landing/sections/command-bar"
import { StaffSection } from "@/components/landing/sections/staff"
import { PricingSection } from "@/components/landing/sections/pricing"
import { FaqSection } from "@/components/landing/sections/faq"
import { ManifestoSection } from "@/components/landing/sections/manifesto"

/*
 * The landing page, in the order a buyer should meet it.
 *
 *   Hero       what it is, the risk removed, what it does on open
 *   Story      what a day looks like — the part a generic CRM cannot show
 *   Workflows  which work the product removes
 *   Inventory  the thing being sold, as a record rather than a feature
 *   Command    how you talk to it
 *   Staff      one loop, every role
 *   Pricing    what it costs
 *   FAQ        the objections that block a trial, answered at the price
 *   Manifesto  why it was built, and the last call to action
 *
 * `WinsSection` (sample morning-brief figures) is no longer on the page: its
 * numbers were illustrative, and it put a CTA between Staff and Pricing that
 * competed with the pricing cards themselves. The component is kept for reuse.
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
      <InventorySection />
      <CommandBarSection />
      <StaffSection />
      <PricingSection isAuthed={isAuthed} workspaceSlug={workspaceSlug} />
      <FaqSection />
      <ManifestoSection isAuthed={isAuthed} workspaceSlug={workspaceSlug} />
      <SiteFooter isAuthed={isAuthed} workspaceSlug={workspaceSlug} />
    </div>
  )
}
