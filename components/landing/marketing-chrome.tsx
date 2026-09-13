import { SiteHeader } from "@/components/landing/site-header"
import { SiteFooter } from "@/components/landing/sections/site-footer"
import { CookieBanner } from "@/components/landing/cookie-banner"
import { StickyMobileCta } from "@/components/landing/sticky-mobile-cta"

type Props = {
  children: React.ReactNode
  isAuthed: boolean
  workspaceSlug?: string | null
  /** Home page owns its own header/footer chrome inside LandingClient */
  bare?: boolean
}

export function MarketingChrome({ children, isAuthed, workspaceSlug, bare }: Props) {
  return (
    <div className="min-h-screen bg-background text-foreground selection:bg-foreground selection:text-background">
      {!bare && <SiteHeader isAuthed={isAuthed} workspaceSlug={workspaceSlug} />}
      <main id="main">{children}</main>
      {!bare && <SiteFooter isAuthed={isAuthed} workspaceSlug={workspaceSlug} />}
      <CookieBanner />
      <StickyMobileCta />
    </div>
  )
}
