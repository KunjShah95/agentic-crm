import type { Metadata } from "next"
import { BASE_URL, BRAND, PAGE_BY_PATH } from "@/content/marketing"

export { BASE_URL, BRAND }
export const SITE_URL = BASE_URL

export const SITE = {
  name: BRAND.name,
  tagline: BRAND.tagline,
  description: BRAND.summary,
  contact: {
    company: BRAND.legalName,
    addressLines: [BRAND.city, BRAND.region],
    email: BRAND.email,
    phone: BRAND.phone,
    supportEmail: BRAND.supportEmail,
    hours: "Mon–Sat · 10:00–19:00 IST",
  },
} as const

export const NAV_LINKS = [
  { href: "/product", label: "Product" },
  { href: "/pricing", label: "Pricing" },
  { href: "/contact", label: "Contact" },
] as const

/* Footer navigation. These are DESTINATIONS, not actions — the primary call to
   action is the button in the brand column, and it is the only one.

   "/signup · Start free" used to sit at the end of the product column as a bare
   text link. Once the brand column gained a real button it became a second
   "Start free" on the same screen, which is the opposite of a single dominant
   CTA repeated: it is the same action offered twice in two different visual
   registers, and the eye cannot tell which one is the real button.

   "/contact" also appeared in BOTH columns, so it rendered three times on the
   page (product nav, legal nav, bottom bar). Contact is not a legal document;
   it belongs in the product destinations and nowhere else. */
export const FOOTER_PRODUCT_LINKS = [
  { href: "/product", label: "Features" },
  { href: "/pricing", label: "Pricing" },
  { href: "/compare", label: "Compare" },
  { href: "/contact", label: "Contact" },
] as const

export const FOOTER_LEGAL_LINKS = [
  { href: "/privacy", label: "Privacy" },
  { href: "/terms", label: "Terms" },
] as const

/**
 * Page metadata, resolved from the keyword source of truth.
 *
 * Previously each route hand-wrote its own title and description, which is how
 * `/product` ended up with a bare "Product" as its title while the sitemap and
 * the structured data described something else entirely. Now a page is described
 * in exactly one place, and adding a route without a spec is a type error rather
 * than a silent SEO hole.
 */
export function pageMetadata({ path }: { path: string }): Metadata {
  const spec = PAGE_BY_PATH[path]
  if (!spec) {
    // Loud rather than silent: a marketing route with no keyword spec will
    // otherwise ship a duplicated or empty title and nobody notices for months.
    throw new Error(
      `site-config: no entry in content/marketing.ts for "${path}". Add a PageSpec before shipping the route.`
    )
  }

  const url = `${BASE_URL}${path}`

  // `spec.title` is written to stand alone in a SERP, so it already carries the
  // brand. The layout template appends it again, which produced
  // "… — Estate360 | Estate360". Next resolves the template against `title`,
  // so `absolute` is the only way to ship a title that is already final.
  return {
    title: { absolute: spec.title },
    description: spec.description,
    keywords: [spec.primary, ...spec.secondary].filter(Boolean),
    alternates: {
      canonical: url,
      // The site-wide markdown pointer, per the llms.txt spec. Per-page `.md`
      // twins are not published yet; the `describedby` link in the root layout
      // already tells a crawler where the LLM-readable version of this site
      // lives, which is the part that actually gets followed.
    },
    robots: spec.index
      ? {
          index: true,
          follow: true,
          "max-image-preview": "large",
          "max-snippet": -1,
          "max-video-preview": -1,
        }
      : { index: false, follow: true },
    openGraph: {
      title: spec.title,
      description: spec.description,
      url,
      siteName: BRAND.name,
      locale: "en_IN",
      alternateLocale: ["gu_IN", "hi_IN"],
      type: "website" as const,
      // Metadata merges shallowly in Next.js — without this, subpages lose the
      // root OG image and render cards with no picture.
      images: [
        {
          url: "/opengraph-image",
          width: 1200,
          height: 630,
          alt: `${BRAND.name} — ${BRAND.tagline}`,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: spec.title,
      description: spec.description,
      images: ["/opengraph-image"],
    },
  }
}
