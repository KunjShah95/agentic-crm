import { redirect } from "next/navigation"
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Book a demo | Estate360",
  robots: { index: false, follow: false },
}

/**
 * `/demo` is the URL we put in ads and outbound sequences because it reads
 * like the action being asked for. It exists so the canonical contact page
 * keeps its stable URL while campaigns get a memorable target. UTM params are
 * forwarded so `/demo?utm_source=…` still attributes the lead.
 */
export default async function DemoPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const params = await searchParams
  const qs = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (typeof value === "string") qs.set(key, value)
  }
  redirect(qs.size > 0 ? `/contact?${qs.toString()}` : "/contact")
}
