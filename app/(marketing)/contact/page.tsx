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
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=600&auto=format&fit=crop&q=60&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8MTh8fGJ1c2luZXNzJTIwb2ZmaWNlfGVufDB8fDB8fHww"
              alt="Estate360 team office in Ahmedabad, Gujarat"
              width={600}
              height={380}
              className="h-64 w-full object-cover"
              decoding="async"
            />
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
