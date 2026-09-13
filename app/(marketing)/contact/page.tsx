import type { Metadata } from "next"
import { auth } from "@/lib/auth"
import { MarketingChrome } from "@/components/landing/marketing-chrome"
import { PageHero } from "@/components/landing/page-hero"
import { ContactForm } from "@/components/landing/contact-form"
import { pageMetadata, SITE } from "@/components/landing/site-config"
import { Card, CardContent } from "@/components/ui/card"
import { Mail, MapPin, Phone, Clock } from "lucide-react"

export const metadata: Metadata = pageMetadata({
  title: "Contact",
  description:
    "Contact Estate360 in Ahmedabad — Mondeal Heights, SG Highway. Email hello@estate360.in or call +91 79 4890 2200. Book a NAAR demo for your sites.",
  path: "/contact",
})

export default async function ContactPage() {
  const session = await auth()
  const workspaceSlug = session?.workspaces?.[0]?.slug ?? null
  const isAuthed = !!session
  const { contact } = SITE

  return (
    <MarketingChrome isAuthed={isAuthed} workspaceSlug={workspaceSlug}>
      <PageHero
        eyebrow="CONTACT · AHMEDABAD"
        title="Talk to the team that ships for NAAR."
        description="Whether you run one tower or a network of sites — tell us your inventory pain. We reply within one business day."
        primaryCta={{ href: "#contact-form", label: "Send a message" }}
        secondaryCta={{ href: `mailto:${contact.email}`, label: contact.email }}
      />

      <section className="mx-auto grid max-w-[1280px] gap-10 px-6 py-14 lg:grid-cols-[0.95fr_1.05fr] lg:px-8 lg:py-16">
        <div className="space-y-6">
          <Card className="overflow-hidden border-border/60">
            {/* Brand panel — skyline "loop" graphic in place of stock photography */}
            <div aria-hidden className="relative h-40 overflow-hidden bg-foreground">
              <div className="absolute inset-0 bg-[linear-gradient(to_right,oklch(0.99_0.002_85/0.06)_1px,transparent_1px),linear-gradient(to_bottom,oklch(0.99_0.002_85/0.06)_1px,transparent_1px)] bg-[size:32px_32px]" />
              <div className="absolute -right-10 -top-10 size-40 rounded-full bg-brand/25 blur-2xl" />
              {/* skyline */}
              <svg className="absolute bottom-0 left-0 right-0 h-24 w-full text-brand/70" viewBox="0 0 400 96" preserveAspectRatio="none" fill="currentColor" aria-hidden>
                <rect x="20" y="38" width="34" height="58" opacity=".35" />
                <rect x="62" y="20" width="26" height="76" opacity=".55" />
                <rect x="96" y="46" width="40" height="50" opacity=".3" />
                <rect x="146" y="8" width="30" height="88" opacity=".7" />
                <rect x="184" y="34" width="24" height="62" opacity=".4" />
                <rect x="216" y="52" width="44" height="44" opacity=".28" />
                <rect x="268" y="16" width="28" height="80" opacity=".6" />
                <rect x="304" y="42" width="36" height="54" opacity=".35" />
                <rect x="348" y="28" width="22" height="68" opacity=".5" />
              </svg>
              <div className="absolute bottom-4 left-5 font-mono text-[11px] tracking-[0.16em] text-background/70">
                SG HIGHWAY → SOUTH BOPAL
              </div>
            </div>
            <CardContent className="space-y-4 p-5">
              <div className="flex gap-3">
                <MapPin className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
                <address className="not-italic text-sm leading-6">
                  <div className="font-medium">{contact.company}</div>
                  {contact.addressLines.map((line) => (
                    <div key={line} className="text-muted-foreground">
                      {line}
                    </div>
                  ))}
                </address>
              </div>
              <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm">
                <a href={`mailto:${contact.email}`} className="inline-flex items-center gap-2 hover:underline">
                  <Mail className="size-4 text-muted-foreground" aria-hidden />
                  {contact.email}
                </a>
                <a
                  href={`tel:${contact.phone.replace(/\s/g, "")}`}
                  className="inline-flex items-center gap-2 hover:underline"
                >
                  <Phone className="size-4 text-muted-foreground" aria-hidden />
                  {contact.phone}
                </a>
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Clock className="size-4" aria-hidden />
                {contact.hours}
              </div>
            </CardContent>
          </Card>
          <p className="text-[13px] leading-5 text-muted-foreground">
            Prefer WhatsApp for a quick inventory walkthrough? Mention your RERA project name in the form — we&apos;ll
            route you to the right AE.
          </p>
        </div>

        <div id="contact-form" className="scroll-mt-24 rounded-[20px] border bg-card p-6 shadow-sm sm:p-8">
          <h2 className="text-lg font-semibold tracking-tight">Book a demo or ask a question</h2>
          <p className="mt-1 text-sm text-muted-foreground">All fields marked * are required. We never sell your leads.</p>
          <div className="mt-6">
            <ContactForm />
          </div>
        </div>
      </section>
    </MarketingChrome>
  )
}
