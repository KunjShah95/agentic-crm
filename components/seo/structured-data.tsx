import { BASE_URL, BRAND, FAQ, PAGES } from "@/content/marketing"

/**
 * Structured data, generated from the same source as the pages.
 *
 * The failure mode this prevents: someone edits the FAQ on the landing page and
 * forgets the `FAQPage` block, so the rich result keeps showing last quarter's
 * answer. Deriving both from one array makes that impossible.
 *
 * Every node here is something a buyer could verify. Fabricated `aggregateRating`
 * or invented testimonials are the most common way a site earns a manual
 * penalty, and they are the one thing in this file that would be worth doing
 * wrong.
 */

/** Organization + the site-level identity most crawlers read first. */
export function organizationLd() {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": `${BASE_URL}/#organization`,
    name: BRAND.name,
    legalName: BRAND.legalName,
    url: BASE_URL,
    logo: `${BASE_URL}/icon`,
    description: BRAND.summary,
    email: BRAND.email,
    telephone: BRAND.phone,
    foundingDate: BRAND.founded,
    address: {
      "@type": "PostalAddress",
      addressLocality: BRAND.city,
      addressRegion: BRAND.region,
      addressCountry: BRAND.country,
    },
    contactPoint: [
      {
        "@type": "ContactPoint",
        contactType: "sales",
        email: BRAND.email,
        telephone: BRAND.phone,
        availableLanguage: ["en", "gu", "hi"],
        areaServed: "IN",
      },
      {
        "@type": "ContactPoint",
        contactType: "support",
        email: BRAND.supportEmail,
        availableLanguage: ["en", "gu", "hi"],
        areaServed: "IN",
      },
    ],
  }
}

/** The commercial node: what it is, what it costs, how to try it. */
export function softwareLd() {
  return {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    "@id": `${BASE_URL}/#software`,
    name: BRAND.name,
    applicationCategory: "BusinessApplication",
    applicationSubCategory: "CRM",
    operatingSystem: "Web",
    url: BASE_URL,
    description: BRAND.summary,
    inLanguage: ["en", "gu", "hi"],
    publisher: { "@id": `${BASE_URL}/#organization` },
    featureList: [
      "Lead and contact management",
      "Deal pipeline with stage board",
      "Inventory management with CSV import",
      "Cost sheet calculation",
      "Booking and construction-linked payment milestones",
      "GPS-checked site visits with offline capture",
      "Broker-scoped inventory and commission ledger",
      "RERA-aligned document generation",
      "WhatsApp inbox in English, Gujarati and Hindi",
      "AI next-best-action ranking",
      "Association lead pool and inventory exchange",
    ],
    offers: {
      "@type": "AggregateOffer",
      priceCurrency: "INR",
      lowPrice: "1499",
      highPrice: "7999",
      offerCount: "3",
      offers: [
        { "@type": "Offer", name: "Builder", price: "1499", priceCurrency: "INR" },
        { "@type": "Offer", name: "Team", price: "3999", priceCurrency: "INR" },
        { "@type": "Offer", name: "Network", price: "7999", priceCurrency: "INR" },
      ],
    },
  }
}

/**
 * FAQPage.
 *
 * `@id` is set per-page so two pages can both carry an FAQ node without
 * colliding — otherwise the second one is treated as a duplicate of the first
 * and dropped.
 */
export function faqLd(path: string) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "@id": `${BASE_URL}${path}#faq`,
    mainEntity: FAQ.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a },
    })),
  }
}

/** Breadcrumbs, so a SERP shows the path instead of a bare URL. */
export function breadcrumbLd(trail: { name: string; path: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: trail.map((t, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: t.name,
      item: `${BASE_URL}${t.path}`,
    })),
  }
}

/** The full page-1 graph: who we are, what we sell, what it costs. */
export function graphLd() {
  return [organizationLd(), softwareLd(), faqLd("/")]
}

/** Keyword targets, exposed for the sitemap and for internal link tests. */
export function keywordMap(): Record<string, string[]> {
  return Object.fromEntries(
    PAGES.filter((p) => p.primary).map((p) => [p.path, [p.primary, ...p.secondary]])
  )
}
