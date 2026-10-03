import type { Metadata } from "next"
import { Fraunces, Inter, JetBrains_Mono } from "next/font/google"
import { SessionProvider } from "next-auth/react"
import { Toaster } from "@/components/ui/sonner"
import { ThemeProvider } from "@/components/theme-provider"
import { AnalyticsGate } from "@/components/analytics/analytics-gate"
import { AdTags } from "@/components/analytics/ad-tags"
import { UtmCapture } from "@/components/analytics/utm-capture"
import { BASE_URL, BRAND } from "@/content/marketing"
import "./globals.css"

/*
 * TWO TYPEFACES. That is the whole system, and this block is where it is
 * enforced — every family that is not declared here does not reach the browser.
 *
 *   Inter       — the sans. Every word of body copy, every control, every
 *                 numeral in the product. Marketing and app share it, so a
 *                 price in a landing section and the same price in a deal row
 *                 are set in the same face at the same weight.
 *   Fraunces    — the display serif. Page h1/h2 only, where the brand wants to
 *                 be editorial rather than administrative.
 *
 * JetBrains Mono is a third family but not a third voice: it is a data face,
 * sanctioned only for tabular money, IDs and secrets (see the `data-mono`
 * convention). Nothing sets a sentence in it.
 *
 * The previous setup loaded four. Outfit served as `--font-sans` and was then
 * force-overridden to Inter inside `.app-scope`, so every app page downloaded a
 * family it never rendered, and every marketing page downloaded one it only
 * partially rendered. One sans removes both the waste and the override.
 */
const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
  weight: ["400", "700"],
  display: "swap",
})

/*
 * Fraunces runs on the opsz axis and `axes` opts into the variable file, so it
 * is no longer restricted to one weight — hence no weight list here.
 */
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

/**
 * Site-wide defaults.
 *
 * The per-page title and description now come from `content/marketing.ts` via
 * `pageMetadata`. What is left here is what genuinely applies to every URL —
 * the brand suffix, the verification tokens, and the crawler policy.
 */
export const metadata: Metadata = {
  metadataBase: new URL(BASE_URL),
  title: {
    default: `${BRAND.name} — ${BRAND.tagline}`,
    template: `%s | ${BRAND.name}`,
  },
  description: BRAND.summary,
  applicationName: BRAND.name,
  authors: [{ name: BRAND.name }],
  creator: BRAND.name,
  publisher: BRAND.legalName,
  keywords: [
    "real estate crm",
    "property crm",
    "real estate lead management",
    "real estate sales software india",
    "inventory management software",
    "cost sheet software",
    "site visit tracking",
    "builder crm",
    "RERA compliance software",
    "WhatsApp CRM",
    "channel partner management",
  ],
  category: "Business",
  alternates: { canonical: BASE_URL },
  openGraph: {
    type: "website",
    locale: "en_IN",
    alternateLocale: ["gu_IN", "hi_IN"],
    url: BASE_URL,
    siteName: BRAND.name,
    title: `${BRAND.name} — ${BRAND.tagline}`,
    description: BRAND.summary,
    images: [
      {
        url: "/opengraph-image",
        width: 1200,
        height: 630,
        alt: `${BRAND.name} — enquiries, site visits, bookings and collections in one workspace`,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: `${BRAND.name} — ${BRAND.tagline}`,
    description: BRAND.summary,
    images: ["/opengraph-image"],
  },
  icons: {
    icon: [{ url: "/icon", type: "image/png" }],
    apple: [{ url: "/apple-icon", type: "image/png" }],
  },
  manifest: "/manifest.json",
  robots: {
    index: true,
    follow: true,
    "max-image-preview": "large",
    "max-snippet": -1,
    "max-video-preview": -1,
  },
  verification: {
    google: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION,
  },
  other: {
    "geo.region": "IN-GJ",
    "geo.placename": BRAND.city,
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${inter.variable} ${fraunces.variable} ${jetbrainsMono.variable} h-full antialiased`}
    >
      <head>
        {/* Matches `--brand` (oklch 0.58 0.16 68), which renders to rgb(182,99,0).
            This was #C27803, a hardcoded hex that had drifted from the token, so
            the mobile browser chrome was a slightly different amber than the
            site. If you re-step `--brand`, re-derive this rather than eyeballing
            it — the token is the source of truth. */}
        <meta name="theme-color" content="#B66300" />
        {/*
          Machine-readable pointers, per the llms.txt spec. Cheap, invisible to
          users, and they are how a crawler finds the markdown twins of these
          pages without being told twice.
        */}
        <link rel="alternate" type="text/markdown" href={`${BASE_URL}/llms.txt`} />
        <link rel="describedby" href={`${BASE_URL}/llms.txt`} />
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
        <UtmCapture />
        <AnalyticsGate />
        <AdTags />
      </body>
    </html>
  )
}
