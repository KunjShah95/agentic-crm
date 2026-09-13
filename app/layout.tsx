import type { Metadata } from "next"
import { Fraunces, Outfit, JetBrains_Mono } from "next/font/google"
import { SessionProvider } from "next-auth/react"
import { Toaster } from "@/components/ui/sonner"
import { ThemeProvider } from "@/components/theme-provider"
import { Analytics } from "@vercel/analytics/next"
import { SpeedInsights } from "@vercel/speed-insights/next"
import "./globals.css"

const outfit = Outfit({
  variable: "--font-sans",
  subsets: ["latin"],
})

const fraunces = Fraunces({
  variable: "--font-display",
  subsets: ["latin"],
  axes: ["SOFT", "WONK", "opsz"],
})

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
})

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://estate360.vercel.com"

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "Estate360 — Multi-tenant CRM for founders & sales teams",
    template: "%s · Estate360",
  },
  description:
    "Real Estate + generic CRM for NAAR/Gujarat: inventory (Project→Unit), HOLD→BOOKING→CLP, GPS site visits, broker scope, RERA docs, WhatsApp inbox, AI next-best-action, reports, public sites + buyer portal, and association shared pool. Workspace-scoped, verified.",
  keywords: [
    "Estate360",
    "Real Estate CRM",
    "NAAR",
    "Ahmedabad CRM",
    "multi-tenant CRM",
    "RERA",
    "CLP",
    "broker CRM",
    "WhatsApp CRM",
    "inventory CRM",
    "Gujarat CRM",
  ],
  authors: [{ name: "Estate360" }],
  creator: "Estate360",
  publisher: "Estate360",
  alternates: { canonical: siteUrl, languages: { en: `${siteUrl}/`, gu: `${siteUrl}/?lang=gu`, hi: `${siteUrl}/?lang=hi` } },
  openGraph: {
    type: "website",
    locale: "en_IN",
    alternateLocale: ["gu_IN", "hi_IN"],
    url: siteUrl,
    siteName: "Estate360",
    title: "Estate360 — The CRM that loops: contacts → deals → revenue",
    description:
      "Switch workspaces, drag a deal, watch the loop close. Contacts, orgs, deals, projects, bookings, AI, and NAAR association — workspace-scoped.",
    images: [{ url: "/opengraph-image", width: 1200, height: 630, alt: "Estate360 — Ahmedabad sites from foundation to possession on loop" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Estate360 — pipeline finally in a loop",
    description: "Multi-tenant CRM for founders: inventory, bookings, AI, and NAAR association. Try the live demo.",
    images: ["/opengraph-image"],
  },
  icons: {
    icon: [{ url: "/icon", type: "image/png" }],
    apple: [{ url: "/apple-icon", type: "image/png" }],
  },
  manifest: "/manifest.json",
  robots: { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1, "max-video-preview": -1 },
  verification: { google: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION },
  category: "Business",
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? "https://estate360.vercel.com"
  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "Organization",
      name: "Estate360",
      url: base,
      logo: `${base}/favicon.ico`,
    },
    {
      "@context": "https://schema.org",
      "@type": "WebSite",
      name: "Estate360",
      url: base,
    },
  ]
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${outfit.variable} ${fraunces.variable} ${jetbrainsMono.variable} h-full antialiased`}
    >
      <head>
        <meta name="theme-color" content="#C27803" />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      </head>
      <body className="min-h-full">
        <SessionProvider>
          <ThemeProvider
            attribute="class"
            defaultTheme="system"
            enableSystem
            disableTransitionOnChange
          >
            {children}
            <Toaster richColors position="top-right" />
          </ThemeProvider>
        </SessionProvider>
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  )
}
