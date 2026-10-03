import type { Metadata } from "next"
import { auth } from "@/lib/auth"
import { MarketingChrome } from "@/components/landing/marketing-chrome"
import { PageHero } from "@/components/landing/page-hero"
import { ContactForm } from "@/components/landing/contact-form"
import { pageMetadata, SITE } from "@/components/landing/site-config"
import { Card, CardContent } from "@/components/ui/card"
import { Mail, MapPin, Phone, Clock } from "lucide-react"

export const metadata: Metadata = pageMetadata({ path: "/contact" })

/**
 * Plain statements of what a submitter gets. No SLA we cannot hold, no "our
 * dedicated team of experts", no invented headcount — the point of the block is
 * to reduce uncertainty about the wait, which "we reply within one business day"
 * in the hero promises but never shows.
 */
const NEXT_STEPS = [
  "We read it before we reply, so the first response is about your sites, not a calendar link.",
  "A reply within one business day, by email or WhatsApp — whichever you gave us.",
  "If it looks like a fit, a 30-minute call with someone who has run a NAAR-registered site.",
]

export default async function ContactPage() {
  const session = await auth()
  const workspaceSlug = session?.workspaces?.[0]?.slug ?? null
  const isAuthed = !!session
  const { contact } = SITE

  return (
    <MarketingChrome isAuthed={isAuthed} workspaceSlug={workspaceSlug}>
      <PageHero
        title="Talk to the team that ships for NAAR."
        description="Whether you run one tower or a network of sites — tell us your inventory pain. We reply within one business day."
        primaryCta={{ href: "#contact-form", label: "Send a message" }}
        secondaryCta={{ href: `mailto:${contact.email}`, label: "Email us instead" }}
      />

      <section className="mx-auto grid max-w-[1280px] gap-10 px-6 py-14 lg:grid-cols-[0.95fr_1.05fr] lg:px-8 lg:py-16">
        <div className="space-y-6">
          <Card className="border-border/60">
            {/* This card used to open with a 160px image panel. It held a stock
                Unsplash office, alt-texted "Estate360 team workspace" and
                captioned "SG HIGHWAY → SOUTH BOPAL" — a generic office presented
                as this company's real Ahmedabad premises. A photo is treated as
                evidence in a way a sentence is not, and the manifesto section had
                already removed invented testimonials on exactly that reasoning, so
                shipping the stock image contradicted a decision the codebase had
                already made.

                Replacing it with a decorative gradient panel was the wrong fix and
                was reverted. A blueprint grid at 6% white over a near-black ground
                renders as a murky smear, and an amber radial offset to one side
                reads as a stain rather than as lit surface — the panel came out
                looking like a failed image load, which is worse than the stock
                photo because at least that was legible as a picture. It also
                duplicated the footer's texture language on a page that does not
                need it.

                So the panel is gone entirely and the space carries content
                instead: what actually happens after someone sends the form. That
                is the question a prospective builder has at this point in the
                page, and it was previously unanswered. No image, no external
                request, no implied headcount. */}
            <CardContent className="p-5 sm:p-6">
              <h2 className="text-[15px] font-semibold tracking-[-0.01em]">
                What happens after you send this
              </h2>
              <ol className="rule-y mt-4">
                {NEXT_STEPS.map((step, i) => (
                  <li key={step} className="flex gap-3 py-3 first:pt-0">
                    <span className="mt-px flex size-5 shrink-0 items-center justify-center rounded-full bg-brand/10 text-[11px] font-semibold tabular-nums text-brand-solid">
                      {i + 1}
                    </span>
                    <span className="text-[13px] leading-5">{step}</span>
                  </li>
                ))}
              </ol>
            </CardContent>

            <CardContent className="space-y-4 border-t p-5">
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
                <a href={`mailto:${contact.email}`} className="tap-target inline-flex items-center gap-2 hover:underline">
                  <Mail className="size-4 text-muted-foreground" aria-hidden />
                  {contact.email}
                </a>
                <a
                  href={`tel:${contact.phone.replace(/\s/g, "")}`}
                  className="tap-target inline-flex items-center gap-2 hover:underline"
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

        <div id="contact-form" className="scroll-mt-24 rounded-md border bg-card p-6 shadow-sm sm:p-8">
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
