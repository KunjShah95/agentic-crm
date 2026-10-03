import type { Metadata } from "next"
import Link from "next/link"
import { auth } from "@/lib/auth"
import { MarketingChrome } from "@/components/landing/marketing-chrome"
import { PageHero } from "@/components/landing/page-hero"
import { PricingSection } from "@/components/landing/sections/pricing"
import { pageMetadata } from "@/components/landing/site-config"
import { JsonLd } from "@/components/seo/json-ld"
import { softwareLd } from "@/components/seo/structured-data"
import { FAQ } from "@/content/marketing"
import { Button } from "@/components/ui/button"

/*
 * Pricing pages fail in one of two ways: the table is complete and unreadable,
 * or it is readable and raises three questions the sales team has to answer on
 * a call. The FAQ below exists to close the second set — cancellation, export,
 * and what the trial actually is — because those are the questions that decide
 * whether a buyer clicks Start or opens a chat.
 */
const PRICING_FAQ = FAQ.filter((f) =>
  [
    "What happens to my data if I leave?",
    "Is there a free trial?",
    "Who is it built for?",
    "Can a broker see our whole inventory?",
  ].includes(f.q)
)

export const metadata: Metadata = pageMetadata({ path: "/pricing" })

export default async function PricingPage() {
  const session = await auth()
  const workspaceSlug = session?.workspaces?.[0]?.slug ?? null
  const isAuthed = !!session
  const cta = isAuthed && workspaceSlug ? `/${workspaceSlug}/contacts` : "/signup"

  return (
    <MarketingChrome isAuthed={isAuthed} workspaceSlug={workspaceSlug}>
      {/*
        The offer graph lives on the pricing page, not only the homepage. A
        crawler that lands here is closer to converting, and an offer without a
        price cannot produce a price comparison.
      */}
      <JsonLd
        data={[
          softwareLd(),
          {
            "@context": "https://schema.org",
            "@type": "FAQPage",
            "@id": "/pricing#faq",
            mainEntity: PRICING_FAQ.map((f) => ({
              "@type": "Question",
              name: f.q,
              acceptedAnswer: { "@type": "Answer", text: f.a },
            })),
          },
        ]}
      />

      <PageHero
        title="Priced per workspace, not per trick."
        description="Every plan includes RERA documents, CLP demand letters, GPS site visits, broker scoping, and WhatsApp in English, Gujarati and Hindi. Export your data whenever you want."
        primaryCta={{ href: cta, label: isAuthed ? "Open workspace" : "Start free" }}
        secondaryCta={{ href: "/contact", label: "Ask about Network" }}
      />

      <PricingSection isAuthed={isAuthed} workspaceSlug={workspaceSlug} />

      {/*
        Rendered in the page body, not just in the JSON-LD. An FAQ that exists
        only in structured data is a rule violation waiting to happen, and it
        gives a human nothing to read.
      */}
      <section className="mx-auto max-w-[760px] px-6 py-16 lg:px-8">
        <h2 className="text-[26px] font-semibold tracking-[-0.02em]">
          The questions that decide it
        </h2>
        <dl className="mt-8 divide-y">
          {PRICING_FAQ.map((f) => (
            <div key={f.q} className="py-5 first:pt-0">
              <dt className="text-[14px] font-semibold tracking-[-0.005em]">{f.q}</dt>
              <dd className="mt-1.5 text-[14px] leading-6 text-muted-foreground">{f.a}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-6 text-[14px] text-muted-foreground">
          Comparing options first? See{" "}
          <Link href="/compare/excel" className="font-medium text-foreground underline underline-offset-4">
            Estate360 vs an Excel + WhatsApp setup
          </Link>{" "}
          or{" "}
          <Link href="/compare/generic-crm" className="font-medium text-foreground underline underline-offset-4">
            vs a generic CRM
          </Link>
          .
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Button
            variant="brand"
            size="lg"
            className="h-11 px-7"
            render={<Link href={cta} />}
          >
            {isAuthed ? "Open workspace" : "Start free"}
          </Button>
          <Button
            variant="outline"
            size="lg"
            className="h-11 px-6"
            render={<Link href="/contact" />}
          >
            Ask a question
          </Button>
        </div>
      </section>
    </MarketingChrome>
  )
}
