import Link from "next/link"
import { Button } from "@/components/ui/button"
import { ArrowUpRight } from "lucide-react"

type Props = {
  eyebrow?: string
  title: React.ReactNode
  description: string
  primaryCta?: { href: string; label: string }
  secondaryCta?: { href: string; label: string }
}

/**
 * Above-the-fold hero for the marketing subpages (/product, /pricing, /contact).
 *
 * Changed in the anti-slop pass:
 *  - The glassy rounded-full badge with a status dot and backdrop-blur is gone.
 *    It was the same templated eyebrow pill the home hero had. Now the same
 *    rule-and-label eyebrow the home hero uses, so the two read as one system.
 *  - Buttons came off pills onto the page's single radius scale.
 *  - ShaderBackground + SpotlightGrid are replaced by the shared .field-gradient
 *    wash, so every marketing hero draws from one gradient. Both components were
 *    used nowhere else and have been removed; the intent behind them (a lit,
 *    non-flat hero ground) is preserved in CSS at a fraction of the cost.
 */
export function PageHero({ eyebrow, title, description, primaryCta, secondaryCta }: Props) {
  return (
    <section className="relative isolate overflow-hidden border-b border-border/70">
      <div aria-hidden className="field-gradient -z-10" />
      <div
        aria-hidden
        className="absolute inset-x-0 bottom-0 -z-10 h-32 bg-gradient-to-t from-background to-transparent"
      />

      <div className="relative mx-auto max-w-[880px] px-6 pb-16 pt-16 lg:pb-24 lg:pt-20">
        {eyebrow ? (
          <p className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.16em] text-brand">
            <span className="h-px w-6 bg-brand/50" aria-hidden />
            {eyebrow}
          </p>
        ) : null}

        <h1 className="mt-6 font-display text-[36px] font-semibold leading-[1.05] tracking-[-0.035em] text-balance sm:text-[48px]">
          {title}
        </h1>

        <p className="mt-5 max-w-[56ch] text-[16px] leading-7 text-pretty text-muted-foreground">
          {description}
        </p>

        {(primaryCta || secondaryCta) && (
          <div className="mt-8 flex flex-wrap items-center gap-3">
            {primaryCta ? (
              <Button
                size="lg"
                className="group h-11 gap-2 px-7"
                render={<Link href={primaryCta.href} />}
              >
                {primaryCta.label}
                <ArrowUpRight
                  className="size-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
                  aria-hidden
                />
              </Button>
            ) : null}
            {secondaryCta ? (
              <Button
                size="lg"
                variant="outline"
                className="h-11 border-border bg-card px-6"
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
