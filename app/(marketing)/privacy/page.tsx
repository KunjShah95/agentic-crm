import type { Metadata } from "next"
import { auth } from "@/lib/auth"
import { MarketingChrome } from "@/components/landing/marketing-chrome"
import { PageHero } from "@/components/landing/page-hero"
import { pageMetadata, SITE } from "@/components/landing/site-config"

export const metadata: Metadata = pageMetadata({
  title: "Privacy Policy",
  description:
    "Estate360 Privacy Policy — how we collect, use, and protect personal data for builders, brokers, and buyers under India's DPDP Act context.",
  path: "/privacy",
})

const SECTIONS: { h: string; p: string[] }[] = [
  {
    h: "Who we are",
    p: [
      `${SITE.contact.company} (“Estate360”, “we”) operates the Estate360 product and website. Registered / operating address: ${SITE.contact.addressLines.join(", ")}.`,
      `Contact for privacy requests: ${SITE.contact.supportEmail} or ${SITE.contact.phone}.`,
    ],
  },
  {
    h: "Data we collect",
    p: [
      "Account data: name, email, phone, workspace membership, and role.",
      "Customer CRM data you enter: contacts, deals, organizations, inventory, bookings, documents, WhatsApp messages, and site-visit GPS check-ins — processed on your behalf as a processor / service provider.",
      "Usage data: device, browser, IP (approximate), pages viewed, and performance metrics via Vercel Analytics / Speed Insights when you accept analytics cookies.",
      "Marketing forms: name, work email, company, optional phone, and message content.",
    ],
  },
  {
    h: "How we use data",
    p: [
      "To provide, secure, and improve the Estate360 service (multi-tenant workspace isolation by workspaceId).",
      "To communicate about product updates, billing, and support.",
      "To comply with law (including RERA-related document retention you configure) and enforce our Terms.",
      "We do not sell personal data. We do not use your tenant CRM data to train public foundation models.",
    ],
  },
  {
    h: "Legal bases & DPDP",
    p: [
      "We process personal data with consent, for contract performance, or for legitimate interests that do not override your rights — aligned with India’s Digital Personal Data Protection Act, 2023 principles where applicable.",
      "Workspace Owners are typically the data fiduciary for buyer/contact data stored in their tenant. Estate360 acts as a data processor for that content.",
    ],
  },
  {
    h: "Cookies",
    p: [
      "Essential cookies keep you signed in and protect against CSRF.",
      "Optional analytics cookies help us understand product usage. You can choose “Essential only” in the cookie banner; your choice is stored locally as loop-cookie-consent.",
    ],
  },
  {
    h: "Retention & security",
    p: [
      "Account data is retained while your workspace is active and for a reasonable period after deletion for backups and legal claims.",
      "We use encryption in transit (TLS), role-based access, and workspace-scoped queries. No security practice is perfect — please use strong passwords and invite only trusted members.",
    ],
  },
  {
    h: "Your rights",
    p: [
      "You may request access, correction, or deletion of personal data we hold about you by emailing support@estate360.in. Workspace Owners can export or delete tenant data from settings where available.",
      "If you are a buyer whose data sits in a builder’s workspace, please contact that builder first; we will assist the Owner on verified requests.",
    ],
  },
  {
    h: "Changes",
    p: [
      "We may update this policy. Material changes will be posted on this page with an updated “Last updated” date. Continued use after changes constitutes acceptance where permitted by law.",
    ],
  },
]

export default async function PrivacyPage() {
  const session = await auth()
  const workspaceSlug = session?.workspaces?.[0]?.slug ?? null
  const isAuthed = !!session

  return (
    <MarketingChrome isAuthed={isAuthed} workspaceSlug={workspaceSlug}>
      <PageHero
        title="Privacy Policy"
        description="How Estate360 handles personal data for founders, sales teams, brokers, and the buyers you serve."
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
