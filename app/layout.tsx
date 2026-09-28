import type { Metadata } from "next"
import { Fraunces, Inter, Outfit, JetBrains_Mono } from "next/font/google"
import { SessionProvider } from "next-auth/react"
import { Toaster } from "@/components/ui/sonner"
import { ThemeProvider } from "@/components/theme-provider"
import { Analytics } from "@vercel/analytics/next"
import { SpeedInsights } from "@vercel/speed-insights/next"
import { BASE_URL, BRAND } from "@/content/marketing"
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

/**
 * The app face. Loaded with exactly two static weights on purpose — Inter's
 * variable axis at 100–900 lets the browser interpolate, and interpolated
 * intermediates are why most dashboards look slightly soft at 12–13px. Two
 * weights, and the whole app is forced to choose between them (see the weight
 * remap in `globals.css`).
 */
const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["400", "700"],
  display: "swap",
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
      className={`${outfit.variable} ${fraunces.variable} ${jetbrainsMono.variable} ${inter.variable} h-full antialiased`}
    >
      <head>
        <meta name="theme-color" content="#C27803" />
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
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  )
}
