import Link from "next/link"
import { Button } from "@/components/ui/button"
import { ArrowRight, Layers, MapPin, Mail, Phone } from "lucide-react"
import {
  FOOTER_LEGAL_LINKS,
  FOOTER_PRODUCT_LINKS,
  SITE,
} from "@/components/landing/site-config"

/**
 * Footer — TypeUI Premium adaptation.
 * Texture system: blueprint grid + film grain + outlined watermark, all static
 * (no animation). One accent (brand amber) reserved for the top rule and the
 * start card. Navy #0B1C3D carries the construction identity.
 */

const GRAIN =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.4'/%3E%3C/svg%3E\")"

export function SiteFooter({ isAuthed, workspaceSlug }: { isAuthed: boolean; workspaceSlug?: string | null }) {
  const cta = isAuthed && workspaceSlug ? `/${workspaceSlug}/dashboard` : "/signup"
  const { contact } = SITE

  return (
    <footer className="relative overflow-hidden bg-[#0B1C3D] text-[#E9EDF5] dark:bg-[#0A1428]">
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
        <div className="absolute -top-24 left-1/2 h-48 w-[720px] -translate-x-1/2 rounded-full bg-[radial-gradient(ellipse_at_center,rgba(194,120,3,0.22),transparent_70%)]" />
        {/* outlined watermark */}
        <div
          className="absolute -bottom-10 right-0 hidden select-none font-display text-[176px] font-semibold leading-none tracking-[-0.04em] text-transparent lg:block [-webkit-text-stroke:1px_rgba(233,237,245,0.07)]"
        >
          ESTATE360
        </div>
      </div>

      {/* brand rule */}
      <div aria-hidden className="relative h-[3px] w-full bg-gradient-to-r from-[#C27803] via-[#D9A441] to-transparent" />

      <div className="relative mx-auto max-w-[1280px] px-6 pb-10 pt-14 lg:px-8">
        <div className="grid gap-12 lg:grid-cols-[1.2fr_0.7fr_0.7fr_1fr]">
          {/* brand + contact */}
          <div>
            <div className="flex items-center gap-2.5">
              <span className="flex size-8 items-center justify-center rounded-lg bg-brand text-brand-foreground">
                <Layers className="size-4" aria-hidden />
              </span>
              <span className="font-display text-xl font-semibold tracking-[-0.02em]">Estate360</span>
              <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-[#E9EDF5]/50">CRM</span>
            </div>
            <p className="mt-4 max-w-[340px] text-[14px] leading-6 text-[#E9EDF5]/60">
              Real Estate CRM for Ahmedabad builders — inventory, bookings, GPS visits, RERA, WhatsApp.
              Built on one loop, from foundation to possession.
            </p>
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
                <a href={`mailto:${contact.email}`} className="inline-flex items-center gap-1.5 transition-colors hover:text-white">
                  <Mail className="size-3.5 text-[#D9A441]/70" aria-hidden />
                  {contact.email}
                </a>
                <a href={`tel:${contact.phone.replace(/\s/g, "")}`} className="inline-flex items-center gap-1.5 transition-colors hover:text-white">
                  <Phone className="size-3.5 text-[#D9A441]/70" aria-hidden />
                  {contact.phone}
                </a>
              </div>
            </address>
          </div>

          {/* product */}
          <nav aria-label="Product">
            <div className="font-mono text-[11px] uppercase tracking-[0.16em] text-[#E9EDF5]/40">Product</div>
            <ul className="mt-4 space-y-2.5 text-[14px] text-[#E9EDF5]/70">
              {FOOTER_PRODUCT_LINKS.map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className="transition-colors hover:text-white">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          {/* legal */}
          <nav aria-label="Legal">
            <div className="font-mono text-[11px] uppercase tracking-[0.16em] text-[#E9EDF5]/40">Legal</div>
            <ul className="mt-4 space-y-2.5 text-[14px] text-[#E9EDF5]/70">
              <li>
                <Link href="/privacy" className="transition-colors hover:text-white">
                  Privacy policy
                </Link>
              </li>
              <li>
                <Link href="/terms" className="transition-colors hover:text-white">
                  Terms &amp; conditions
                </Link>
              </li>
              <li>
                <Link href="/contact" className="transition-colors hover:text-white">
                  Talk to us
                </Link>
              </li>
            </ul>
          </nav>

          {/* start card — the one amber surface */}
          <div>
            <div className="mt-4 rounded-xl border border-brand/40 bg-brand/10 p-4 shadow-e2">
              <Button
                size="sm"
                className="w-full gap-1.5 rounded-full bg-brand text-brand-foreground hover:bg-brand/90"
                render={<Link href={cta} />}
              >
                Get started <ArrowRight className="size-3.5" aria-hidden />
              </Button>
            </div>
          </div>
        </div>

        {/* bottom bar */}
        <div className="mt-12 flex flex-col gap-3 border-t border-white/10 pt-6 text-[12px] text-[#E9EDF5]/45 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span>© 2026 Estate360</span>
            {FOOTER_LEGAL_LINKS.map((link) => (
              <span key={link.href} className="inline-flex items-center gap-2">
                <span aria-hidden>·</span>
                <Link href={link.href} className="transition-colors hover:text-white">
                  {link.label}
                </Link>
              </span>
            ))}
          </div>
          <div className="font-mono text-[11px] tracking-wide">Built in Ahmedabad · gu / hi / en</div>
        </div>
      </div>
    </footer>
  )
}
