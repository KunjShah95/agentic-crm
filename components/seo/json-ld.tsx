type JsonLdProps = { data: Record<string, unknown> | Array<Record<string, unknown>> }

export function JsonLd({ data }: JsonLdProps) {
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }} />
}

export function orgJsonLd(base: string) {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "Loop CRM",
    url: base,
    logo: `${base}/favicon.ico`,
    description: "Multi-tenant SaaS CRM for solo founders, freelancers, and small sales teams — contacts, deals, inventory, bookings, AI, and NAAR association.",
    sameAs: [],
  }
}

export function softwareJsonLd(base: string) {
  return {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "Loop CRM",
    applicationCategory: "BusinessApplication",
    operatingSystem: "Web",
    url: base,
    description: "Real Estate + generic CRM: HOLD→BOOKING→CLP, GPS site visits, broker scope, RERA documents, AI next-best-action, reports, public sites + buyer portal, and NAAR association shared pool.",
    offers: { "@type": "Offer", price: "1499", priceCurrency: "INR" },
  }
}

export function faqJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: [
      { "@type": "Question", name: "What is Loop CRM?", acceptedAnswer: { "@type": "Answer", text: "Loop CRM is a multi-tenant CRM for solo founders, freelancers, and small sales teams. It handles contacts, deals, organizations, projects/units, bookings with CLP milestones, site visits with GPS, brokers with scoped visibility, RERA documents, WhatsApp inbox, reports, AI intelligence, and NAAR association pooled leads." } },
      { "@type": "Question", name: "How does the booking flow work?", acceptedAnswer: { "@type": "Answer", text: "Hold → KYC → confirm booking → auto CLP milestones + demand letter #1 → payment schedule → e-sign → possession. Zero Excel, every transition logged as Activity." } },
      { "@type": "Question", name: "Is it workspace-scoped and secure?", acceptedAnswer: { "@type": "Answer", text: "Yes. Every query is filtered by workspaceId and checked by requireWorkspaceMember. Brokers see only allocated inventory via brokerScopeFilter. Cross-workspace leaks are tested." } },
      { "@type": "Question", name: "Does it support Gujarati/Hindi?", acceptedAnswer: { "@type": "Answer", text: "Yes. WhatsApp templates and public sites have en/gu/hi variants; UI i18n scaffold is ready for full vernacular." } },
    ],
  }
}

export function howToJsonLd(base: string) {
  return {
    "@context": "https://schema.org",
    "@type": "HowTo",
    name: "How to run a booking in Loop CRM",
    totalTime: "PT5M",
    tool: [{ "@type": "HowToTool", name: "Loop CRM" }],
    step: [
      { "@type": "HowToStep", name: "Import or create a unit", text: "Create Project → Tower → Floor → Unit, or CSV import 200 units." },
      { "@type": "HowToStep", name: "Generate cost sheet", text: "Base + GST + stamp + others → total in under 30 seconds, share on WhatsApp." },
      { "@type": "HowToStep", name: "Hold and book", text: "Hold → KYC → confirm booking — 8 CLP milestones auto-created." },
      { "@type": "HowToStep", name: "Demand letter", text: "Render RERA shortcodes {{rera_no}} {{carpet_area}} {{total}} → PDF + e-sign stub." },
    ],
    url: `${base}/#workflow`,
  }
}
