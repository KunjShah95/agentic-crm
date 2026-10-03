import Link from "next/link"
import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { auth } from "@/lib/auth"
import { MarketingChrome } from "@/components/landing/marketing-chrome"
import { PageHero } from "@/components/landing/page-hero"
import { pageMetadata } from "@/components/landing/site-config"
import { JsonLd } from "@/components/seo/json-ld"
import { breadcrumbLd } from "@/components/seo/structured-data"
import { Button } from "@/components/ui/button"
import { COMPARISON_BY_SLUG, COMPARISONS } from "@/content/comparisons"

export function generateStaticParams() {
  return COMPARISONS.map((c) => ({ slug: c.slug }))
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const comparison = COMPARISON_BY_SLUG[slug]
  if (!comparison) return {}
  return pageMetadata({ path: `/compare/${slug}` })
}

export default async function ComparisonPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const comparison = COMPARISON_BY_SLUG[slug]
  if (!comparison) notFound()

  const session = await auth()
  const workspaceSlug = session?.workspaces?.[0]?.slug ?? null
  const isAuthed = !!session
  const cta = isAuthed && workspaceSlug ? `/${workspaceSlug}/contacts` : "/signup"

  return (
    <MarketingChrome isAuthed={isAuthed} workspaceSlug={workspaceSlug}>
      <JsonLd
        data={breadcrumbLd([
          { name: "Home", path: "/" },
          { name: "Compare", path: "/compare" },
          { name: `vs ${comparison.competitor}`, path: `/compare/${slug}` },
        ])}
      />
      <PageHero
        title={`Estate360 vs ${comparison.competitor}`}
        description={comparison.intro}
        primaryCta={{ href: cta, label: isAuthed ? "Open workspace" : "Start free" }}
        secondaryCta={{ href: "/compare", label: "All comparisons" }}
      />

      <section className="mx-auto max-w-[900px] px-6 py-14 lg:px-8">
        <p className="text-[15px] leading-6 text-muted-foreground">{comparison.verdict}</p>
        <dl className="mt-10 divide-y">
          {comparison.rows.map((row) => (
            <div key={row.question} className="grid gap-3 py-6 sm:grid-cols-[1fr_1fr_1fr] sm:gap-6">
              <dt className="text-[15px] font-semibold">{row.question}</dt>
              <dd className="text-[14px] leading-6 text-muted-foreground">
                <span className="block text-[11px] font-medium uppercase tracking-[0.14em]">
                  {comparison.competitor}
                </span>
                {row.them}
              </dd>
              <dd className="text-[14px] leading-6">
                <span className="block text-[11px] font-medium uppercase tracking-[0.14em] text-brand-solid">
                  Estate360
                </span>
                {row.us}
              </dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="mx-auto max-w-[720px] px-6 py-14 text-center lg:px-8">
        <h2 className="text-[28px] font-semibold tracking-[-0.02em]">Try it on your own data.</h2>
        <p className="mt-3 text-muted-foreground">
          Fourteen days, no card. Import a real project and see whether the pipeline holds up.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Button variant="brand" size="lg" className="h-11 px-7" render={<Link href={cta} />}>
            {isAuthed ? "Open workspace" : "Start free"}
          </Button>
          <Button variant="outline" size="lg" className="h-11 px-6" render={<Link href="/contact" />}>
            Talk to sales
          </Button>
        </div>
      </section>
    </MarketingChrome>
  )
}
