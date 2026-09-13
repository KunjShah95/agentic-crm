import type { Metadata } from "next"
import { auth } from "@/lib/auth"
import { MarketingChrome } from "@/components/landing/marketing-chrome"
import { PageHero } from "@/components/landing/page-hero"
import { pageMetadata, SITE } from "@/components/landing/site-config"

export const metadata: Metadata = pageMetadata({
  title: "Terms & Conditions",
  description:
    "Estate360 Terms & Conditions — acceptable use, subscriptions, trials, liability, and governing law for the multi-tenant CRM service.",
  path: "/terms",
})

const SECTIONS: { h: string; p: string[] }[] = [
  {
    h: "Agreement",
    p: [
      `By accessing estate360.vercel.com or using Estate360, you agree to these Terms with ${SITE.contact.company}, ${SITE.contact.addressLines.join(", ")}.`,
      "If you use Estate360 on behalf of a company, you represent that you have authority to bind that company.",
    ],
  },
  {
    h: "The service",
    p: [
      "Estate360 is a multi-tenant SaaS for contacts, deals, real-estate inventory, bookings (HOLD→BOOKING→CLP), site visits, documents, WhatsApp inbox, AI assists, and association features.",
      "We may modify features during Phase 1. Material removals of paid capabilities will be communicated with reasonable notice.",
    ],
  },
  {
    h: "Accounts & workspaces",
    p: [
      "You are responsible for credentials, invites, and role assignments (Owner / Admin / Sales / Broker / Viewer).",
      "You must not attempt to access another workspace’s data. Every server action is scoped by workspaceId; circumventing tenancy is grounds for immediate suspension.",
    ],
  },
  {
    h: "Customer data",
    p: [
      "You retain ownership of content you upload. You grant Estate360 a limited license to host, process, and display that content solely to provide the service.",
      "You warrant that you have lawful grounds to process buyer and broker personal data (including WhatsApp messages and GPS check-ins) under applicable Indian law.",
    ],
  },
  {
    h: "Trials, billing & cancellation",
    p: [
      "14-day trials may be offered without a card. Paid plans (Builder / Team / Network) renew monthly unless cancelled.",
      "Fees are in INR unless stated otherwise. Taxes (including GST) may apply. You may cancel anytime; access continues through the paid period. No refunds for partial months unless required by law.",
    ],
  },
  {
    h: "Acceptable use",
    p: [
      "No unlawful content, spam, malware, scraping of other tenants, or reverse engineering beyond what law permits.",
      "No use of Estate360 to harass buyers or falsify RERA / KYC documents. GPS check-ins must reflect real site presence.",
    ],
  },
  {
    h: "AI features",
    p: [
      "AI suggestions (next-best-action, drafts, scoring) are assistive only. You remain responsible for decisions, messages, and filings sent to buyers or authorities.",
    ],
  },
  {
    h: "Disclaimer & liability",
    p: [
      "The service is provided “as is”. We do not warrant uninterrupted availability or that AI outputs are error-free.",
      "To the fullest extent permitted by law, Estate360’s aggregate liability for any claim relating to the service is limited to the fees you paid us in the three months preceding the claim. We are not liable for indirect or consequential damages, lost deals, or regulatory penalties arising from your use of the product.",
    ],
  },
  {
    h: "Governing law",
    p: [
      "These Terms are governed by the laws of India. Courts in Ahmedabad, Gujarat shall have exclusive jurisdiction, subject to mandatory consumer protections.",
    ],
  },
  {
    h: "Contact",
    p: [
      `Questions: ${SITE.contact.email} · ${SITE.contact.phone} · ${SITE.contact.addressLines.join(", ")}.`,
    ],
  },
]

export default async function TermsPage() {
  const session = await auth()
  const workspaceSlug = session?.workspaces?.[0]?.slug ?? null
  const isAuthed = !!session

  return (
    <MarketingChrome isAuthed={isAuthed} workspaceSlug={workspaceSlug}>
      <PageHero
        title="Terms & Conditions"
        description="The rules of the road for using Estate360 — trials, tenancy, data, and fair use."
      />
      <article className="mx-auto max-w-[720px] px-6 pb-20 lg:px-8">
        <p className="text-sm text-muted-foreground">Last updated: 13 September 2026</p>
        <div className="mt-8 space-y-10">
          {SECTIONS.map((s) => (
            <section key={s.h}>
              <h2 className="text-lg font-semibold tracking-tight">{s.h}</h2>
              {s.p.map((para) => (
                <p key={para.slice(0, 40)} className="mt-3 text-[15px] leading-7 text-muted-foreground">
                  {para}
                </p>
              ))}
            </section>
          ))}
        </div>
      </article>
    </MarketingChrome>
  )
}
