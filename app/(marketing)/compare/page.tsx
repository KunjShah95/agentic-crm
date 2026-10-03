import Link from "next/link"
import type { Metadata } from "next"
import { auth } from "@/lib/auth"
import { MarketingChrome } from "@/components/landing/marketing-chrome"
import { PageHero } from "@/components/landing/page-hero"
import { pageMetadata } from "@/components/landing/site-config"
import { JsonLd } from "@/components/seo/json-ld"
import { BASE_URL } from "@/content/marketing"
import { breadcrumbLd } from "@/components/seo/structured-data"
import { COMPARISONS } from "@/content/comparisons"

export const metadata: Metadata = pageMetadata({ path: "/compare" })

export default async function CompareIndexPage() {
  const session = await auth()
  const workspaceSlug = session?.workspaces?.[0]?.slug ?? null
  const isAuthed = !!session

  return (
    <MarketingChrome isAuthed={isAuthed} workspaceSlug={workspaceSlug}>
      <JsonLd
        data={[
          breadcrumbLd([
            { name: "Home", path: "/" },
            { name: "Compare", path: "/compare" },
          ]),
          {
            "@context": "https://schema.org",
            "@type": "ItemList",
            itemListElement: COMPARISONS.map((c, i) => ({
              "@type": "ListItem",
              position: i + 1,
              name: `Estate360 vs ${c.competitor}`,
              url: `${BASE_URL}/compare/${c.slug}`,
            })),
          },
        ]}
      />
      <PageHero
        title="Honest comparisons, row by row."
        description="The tools teams actually compare Estate360 against — and where each one stops doing the job."
        primaryCta={{ href: isAuthed && workspaceSlug ? `/${workspaceSlug}/contacts` : "/signup", label: isAuthed ? "Open workspace" : "Start free" }}
        secondaryCta={{ href: "/pricing", label: "See pricing" }}
      />
      <section className="mx-auto max-w-[900px] px-6 py-14 lg:px-8">
        <ul className="grid gap-4 sm:grid-cols-2">
          {COMPARISONS.map((c) => (
            <li key={c.slug}>
              <Link
                href={`/compare/${c.slug}`}
                className="block rounded-md border bg-card p-6 transition-colors hover:border-foreground/20"
              >
                <h2 className="text-[17px] font-semibold tracking-[-0.01em]">
                  Estate360 vs {c.competitor}
                </h2>
                <p className="mt-2 text-[14px] leading-6 text-muted-foreground">{c.verdict}</p>
                <p className="mt-4 text-[13px] font-medium text-brand-solid">Compare →</p>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </MarketingChrome>
  )
}
