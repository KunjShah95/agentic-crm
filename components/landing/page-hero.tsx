import Link from "next/link"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ArrowUpRight } from "lucide-react"

type Props = {
  eyebrow?: string
  title: React.ReactNode
  description: string
  primaryCta?: { href: string; label: string }
  secondaryCta?: { href: string; label: string }
}

/** Above-the-fold page hero: brand signal + one headline + one sentence + CTAs */
export function PageHero({ eyebrow, title, description, primaryCta, secondaryCta }: Props) {
  return (
    <section className="relative overflow-hidden border-b">
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute inset-0 bg-gradient-to-b from-brand-soft/70 via-background to-background" />
        <div
          className="absolute inset-0 opacity-[0.035] dark:opacity-[0.05]"
          style={{
            backgroundImage:
              "linear-gradient(to right, var(--border) 1px, transparent 1px), linear-gradient(to bottom, var(--border) 1px, transparent 1px)",
            backgroundSize: "72px 72px",
          }}
        />
      </div>
      <div className="mx-auto max-w-[880px] px-6 pb-12 pt-12 text-center lg:px-8 lg:pb-16 lg:pt-16">
        {eyebrow ? (
          <Badge variant="outline" className="rounded-full font-mono text-[11px] tracking-[0.12em] text-muted-foreground">
            {eyebrow}
          </Badge>
        ) : null}
        <h1 className="mt-4 font-display text-[36px] font-[600] leading-[1.05] tracking-[-0.03em] text-balance sm:text-[48px]">
          {title}
        </h1>
        <p className="mx-auto mt-4 max-w-[560px] text-[16px] leading-7 text-muted-foreground">{description}</p>
        {(primaryCta || secondaryCta) && (
          <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
            {primaryCta ? (
              <Button size="lg" className="h-11 gap-2 rounded-full px-7" render={<Link href={primaryCta.href} />}>
                {primaryCta.label}
                <ArrowUpRight className="size-4" aria-hidden />
              </Button>
            ) : null}
            {secondaryCta ? (
              <Button
                size="lg"
                variant="outline"
                className="h-11 rounded-full bg-card px-6"
                render={<Link href={secondaryCta.href} />}
              >
                {secondaryCta.label}
              </Button>
            ) : null}
          </div>
        )}
      </div>
    </section>
  )
}
