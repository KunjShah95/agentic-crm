import type { Metadata } from "next"
import { Geist, Geist_Mono } from "next/font/google"
import { SessionProvider } from "next-auth/react"
import { Toaster } from "@/components/ui/sonner"
import { ThemeProvider } from "@/components/theme-provider"
import { Analytics } from "@vercel/analytics/next"
import { SpeedInsights } from "@vercel/speed-insights/next"
import "./globals.css"

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
})

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
})

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://loopcrm.example.com"

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "Loop CRM — Multi-tenant CRM for founders & sales teams",
    template: "%s · Loop CRM",
  },
  description:
    "Real Estate + generic CRM for NAAR/Gujarat: inventory (Project→Unit), HOLD→BOOKING→CLP, GPS site visits, broker scope, RERA docs, WhatsApp inbox, AI next-best-action, reports, public sites + buyer portal, and association shared pool. Workspace-scoped, verified.",
  keywords: [
    "Loop CRM",
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
  authors: [{ name: "Loop CRM" }],
  creator: "Loop CRM",
  publisher: "Loop CRM",
  alternates: { canonical: siteUrl, languages: { en: `${siteUrl}/`, gu: `${siteUrl}/?lang=gu`, hi: `${siteUrl}/?lang=hi` } },
  openGraph: {
    type: "website",
    locale: "en_IN",
    alternateLocale: ["gu_IN", "hi_IN"],
    url: siteUrl,
    siteName: "Loop CRM",
    title: "Loop CRM — The CRM that loops: contacts → deals → revenue",
    description:
      "Switch workspaces, drag a deal, watch the loop close. Contacts, orgs, deals, projects, bookings, AI, and NAAR association — workspace-scoped.",
    images: [{ url: `${siteUrl}/og.png`, width: 1200, height: 630, alt: "Loop CRM — pipeline finally in a loop" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Loop CRM — pipeline finally in a loop",
    description: "Multi-tenant CRM for founders: inventory, bookings, AI, and NAAR association. Try the live demo.",
    images: [`${siteUrl}/og.png`],
  },
  robots: { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1, "max-video-preview": -1 },
  verification: { google: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION },
  category: "Business",
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? "https://loopcrm.example.com"
  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "Organization",
      name: "Loop CRM",
      url: base,
      logo: `${base}/favicon.ico`,
    },
    {
      "@context": "https://schema.org",
      "@type": "WebSite",
      name: "Loop CRM",
      url: base,
      potentialAction: { "@type": "SearchAction", target: `${base}/search?q={search_term_string}`, "query-input": "required name=search_term_string" },
    },
  ]
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        <link rel="canonical" href={base} />
        <meta name="theme-color" content="#7c3aed" />
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
