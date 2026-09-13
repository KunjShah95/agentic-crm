import type { Metadata } from "next"

export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://estate360.vercel.com"

export const SITE = {
  name: "Estate360",
  tagline: "Ahmedabad sites. Foundation to possession — on loop.",
  description:
    "The complete Real Estate CRM for builders and developers. Manage inventory, instant cost sheets, CLP booking milestones, RERA demand letters, GPS site visits, and broker allocations — without Excel or data leaks.",
  contact: {
    company: "Estate360 Technologies Pvt. Ltd.",
    addressLines: [
      "Ahmedabad",
      "Gujarat",
    ],
    email: "hello@estate360.in",
    phone: "+91 79 4890 2200",
    supportEmail: "support@estate360.in",
    hours: "Mon–Sat · 10:00–19:00 IST",
  },
} as const

export const NAV_LINKS = [
  { href: "/product", label: "Product" },
  { href: "/pricing", label: "Pricing" },
  { href: "/contact", label: "Contact" },
] as const

export const FOOTER_PRODUCT_LINKS = [
  { href: "/product", label: "Features" },
  { href: "/pricing", label: "Pricing" },
  { href: "/contact", label: "Contact" },
  { href: "/login", label: "Demo login" },
] as const

export const FOOTER_LEGAL_LINKS = [
  { href: "/privacy", label: "Privacy" },
  { href: "/terms", label: "Terms" },
  { href: "/contact", label: "Contact" },
] as const

type PageMeta = {
  title: string
  description: string
  path: string
  robots?: Metadata["robots"]
}

export function pageMetadata({ title, description, path, robots }: PageMeta): Metadata {
  const url = `${SITE_URL}${path}`
  return {
    title,
    description,
    alternates: { canonical: url },
    robots,
    openGraph: {
      title: `${title} · Estate360`,
      description,
      url,
      siteName: SITE.name,
      locale: "en_IN",
      type: "website",
      // Metadata merges shallowly in Next.js — without this, subpages lose the
      // root OG image and render cards with no picture.
      images: [{ url: "/opengraph-image", width: 1200, height: 630, alt: "Estate360 — the CRM that loops" }],
    },
    twitter: {
      card: "summary_large_image",
      title: `${title} · Estate360`,
      description,
      images: ["/opengraph-image"],
    },
  }
}
