import Link from "next/link"
import { Button } from "@/components/ui/button"
import { ArrowRight, Layers, MapPin, Mail, Phone } from "lucide-react"
import {
  FOOTER_LEGAL_LINKS,
  FOOTER_PRODUCT_LINKS,
  SITE,
} from "@/components/landing/site-config"

/**
 * Footer.
 * Texture system: blueprint grid + film grain + outlined watermark, all static
 * (no animation). One accent (brand amber) reserved for the top rule.
 * Navy #0B1C3D carries the construction identity.
 *
 * This is the one surface that does not read from the token layer. That is a
 * deliberate exception — a navy ground cannot be expressed as a light/dark pair
 * without collapsing the footer into the page — but it does carry two rules
 * that are worth knowing before editing it:
 *
 *  1. Text alpha. Measured on this ground, #E9EDF5 at /40 is 3.37:1 and at /45
 *     is 3.90:1, both under the 4.5:1 that WCAG AA needs for text this small.
 *     /55 is 5.17:1. So /55 is the floor for anything below 14px here. The
 *     hierarchy is carried by size and case, not by dropping alpha into failure.
 *  2. Amber glyphs at /70 are 4.25:1. That is fine — they are icons, and
 *     non-text graphics only need 3:1. Do not "fix" them by raising alpha
 *     without also checking they still read as accent rather than as text.
 */

const GRAIN =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.4'/%3E%3C/svg%3E\")"

export function SiteFooter({
  isAuthed,
  workspaceSlug,
}: {
  isAuthed: boolean
  workspaceSlug?: string | null
}) {
  const { contact } = SITE
  const ctaHref =
    isAuthed && workspaceSlug ? `/${workspaceSlug}/dashboard` : "/signup"

  return (
    /* `pb-24` on the <footer> itself — not on the inner container. This is the
       clearance strip for the sticky mobile CTA, and it has to be padding on the
       outermost element or it will not extend the document's scrollable height.

       With the padding on the inner div instead, the footer's own box still ended
       flush with the bottom of the page. At 375px the CTA button in the brand
       column measured `top: -8` — above the viewport — because there was nothing
       left to scroll. The button looked present in the DOM and was unreachable
       with a thumb: the page simply could not scroll far enough to bring it
       under the CTA's 66px strip. `pb-24` = 96px clears the 66px CTA plus its
       own padding. From `md` up the CTA does not render, so `pb-10` is restored. */
    <footer className="relative overflow-hidden bg-[#0B1C3D] text-[#E9EDF5] pb-24 md:pb-10 dark:bg-[#0A1428]">
      {/* ——— texture layers (static, aria-hidden) ——— */}
      <div aria-hidden className="pointer-events-none absolute inset-0">
        {/* blueprint grid */}
        <div
          className="absolute inset-0 opacity-[0.06]"
          style={{
            backgroundImage:
              "linear-gradient(to right, rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.5) 1px, transparent 1px)",
            backgroundSize: "88px 88px",
          }}
        />
        {/* film grain */}
        <div className="absolute inset-0 opacity-[0.05] mix-blend-overlay" style={{ backgroundImage: GRAIN }} />
        {/* amber dawn glow, top edge — echoes the hero wash */}
        <div className="absolute -top-24 left-1/2 h-48 w-[720px] -translate-x-1/2 rounded-full bg-[radial-gradient(ellipse_at_center,rgba(182,99,0,0.22),transparent_70%)]" />
        {/* outlined watermark */}
        <div
          className="absolute -bottom-10 right-0 hidden select-none font-display text-[176px] font-semibold leading-none tracking-[-0.04em] text-transparent lg:block [-webkit-text-stroke:1px_rgba(233,237,245,0.07)]"
        >
          ESTATE360
        </div>
      </div>

      {/* brand rule */}
      <div aria-hidden className="relative h-[3px] w-full bg-gradient-to-r from-[#B66300] via-[#D9A441] to-transparent" />

      <div className="relative mx-auto max-w-[1280px] px-6 pt-14 lg:px-8">
        <div className="grid gap-12 lg:grid-cols-[1.2fr_0.7fr_0.7fr]">
          {/* brand + contact */}
          <div>
            <div className="flex items-center gap-2.5">
              <span className="flex size-8 items-center justify-center rounded-sm bg-brand text-brand-foreground">
                <Layers className="size-4" aria-hidden />
              </span>
              <span className="font-display text-xl font-semibold tracking-[-0.02em]">Estate360</span>
              <span className="text-[11px] uppercase tracking-[0.2em] text-[#E9EDF5]/55">CRM</span>
            </div>
            <p className="mt-4 max-w-[340px] text-[14px] leading-6 text-[#E9EDF5]/60">
              Real Estate CRM for Ahmedabad builders — inventory, bookings, GPS visits, RERA, WhatsApp.
              Built on one loop, from foundation to possession.
            </p>

            {/* The footer had no call to action at all, on the one surface a
                reader reaches after the whole page. Repeated here with the same
                label and the same `brand` variant as the hero, because "one
                dominant CTA repeated" only works if the repeats are identical.
                On this forced-dark ground the amber fill is the brightest thing
                on screen, which is the correct final note. */}
            <div className="mt-6 flex flex-wrap items-center gap-4">
              <Button variant="brand" size="lg" className="h-11 px-6" render={<Link href={ctaHref} />}>
                {isAuthed ? "Open workspace" : "Start free"}
                <ArrowRight className="size-4" aria-hidden />
              </Button>
              <Link
                href="/contact"
                className="tap-target text-[14px] text-[#E9EDF5]/70 underline-offset-4 transition-colors hover:text-white hover:underline"
              >
                Talk to us
              </Link>
            </div>
            <address className="mt-6 not-italic">
              <div className="flex items-start gap-2 text-[13px] leading-5 text-[#E9EDF5]/70">
                <MapPin className="mt-0.5 size-3.5 shrink-0 text-[#D9A441]/70" aria-hidden />
                <div>
                  <div className="font-medium text-[#E9EDF5]/90">{contact.company}</div>
                  {contact.addressLines.map((line) => (
                    <div key={line}>{line}</div>
                  ))}
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5 text-[13px] text-[#E9EDF5]/70">
                <a href={`mailto:${contact.email}`} className="tap-target inline-flex items-center gap-1.5 transition-colors hover:text-white">
                  <Mail className="size-3.5 text-[#D9A441]/70" aria-hidden />
                  {contact.email}
                </a>
                <a href={`tel:${contact.phone.replace(/\s/g, "")}`} className="tap-target inline-flex items-center gap-1.5 transition-colors hover:text-white">
                  <Phone className="size-3.5 text-[#D9A441]/70" aria-hidden />
                  {contact.phone}
                </a>
              </div>
            </address>
          </div>

          {/* product */}
          <nav aria-label="Product">
            <div className="text-[11px] uppercase tracking-[0.16em] text-[#E9EDF5]/55">Product</div>
            <ul className="mt-4 space-y-2.5 text-[14px] text-[#E9EDF5]/70">
              {FOOTER_PRODUCT_LINKS.map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className="tap-target transition-colors hover:text-white">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          {/* legal — driven by FOOTER_LEGAL_LINKS, not hand-written. This column
              used to hardcode Privacy / Terms / "Talk to us", which meant
              /contact rendered here as well as in the product column and again in
              the bottom bar. Two sources for one nav list is how they drift. */}
          <nav aria-label="Legal">
            <div className="text-[11px] uppercase tracking-[0.16em] text-[#E9EDF5]/55">Legal</div>
            <ul className="mt-4 space-y-2.5 text-[14px] text-[#E9EDF5]/70">
              {FOOTER_LEGAL_LINKS.map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className="tap-target transition-colors hover:text-white">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>

        {/* bottom bar */}
        <div className="mt-12 flex flex-col gap-3 border-t border-white/10 pt-6 text-[12px] text-[#E9EDF5]/55 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span>© 2026 Estate360</span>
            {FOOTER_LEGAL_LINKS.map((link) => (
              <span key={link.href} className="inline-flex items-center gap-2">
                <span aria-hidden>·</span>
                <Link href={link.href} className="tap-target transition-colors hover:text-white">
                  {link.label}
                </Link>
              </span>
            ))}
          </div>
        </div>
      </div>
    </footer>
  )
}
