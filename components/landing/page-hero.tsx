import Link from "next/link"
import { Button } from "@/components/ui/button"
import { ArrowUpRight } from "lucide-react"
import { ShaderBackground } from "@/components/landing/shader-background"
import { SpotlightGrid } from "@/components/landing/spotlight-grid"

type Props = {
  eyebrow?: string
  title: React.ReactNode
  description: string
  primaryCta?: { href: string; label: string }
  secondaryCta?: { href: string; label: string }
}

/** Above-the-fold page hero — shares the home hero's motion system:
 *  slow mesh canvas, cursor-revealed blueprint grid, staggered reveal. */
export function PageHero({ eyebrow, title, description, primaryCta, secondaryCta }: Props) {
  return (
    <section className="relative overflow-hidden border-b">
      {/* signature background layers (all decorative) */}
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute inset-0 opacity-60 [mask-image:linear-gradient(to_bottom,black_0%,black_55%,transparent_100%)]">
          <ShaderBackground className="absolute inset-0" />
        </div>
        <div className="absolute inset-0 bg-gradient-to-b from-[var(--hero-wash-from)]/70 via-[var(--hero-wash-to)]/40 to-background" />
      </div>
      <SpotlightGrid className="-z-10" />

      <div className="relative mx-auto max-w-[880px] px-6 pb-14 pt-14 text-center lg:pb-20 lg:pt-20">
        {eyebrow ? (
          <span className="inline-flex animate-in fade-in slide-in-from-bottom-2 duration-500 items-center gap-2 rounded-full border bg-card/80 px-3.5 py-1.5 font-mono text-[11px] tracking-[0.12em] text-muted-foreground backdrop-blur">
            <span className="size-1.5 rounded-full bg-brand" aria-hidden />
            {eyebrow}
          </span>
        ) : null}
        <h1 className="mt-5 animate-in fade-in slide-in-from-bottom-2 font-display text-[36px] font-[600] leading-[1.05] tracking-[-0.03em] text-balance delay-100 [animation-fill-mode:both] sm:text-[48px]">
          {title}
        </h1>
        <p className="mx-auto mt-4 max-w-[560px] animate-in fade-in slide-in-from-bottom-2 text-[16px] leading-7 text-muted-foreground delay-200 [animation-fill-mode:both]">
          {description}
        </p>
        {(primaryCta || secondaryCta) && (
          <div className="mt-8 flex animate-in fade-in slide-in-from-bottom-2 flex-wrap items-center justify-center gap-3 delay-300 [animation-fill-mode:both]">
            {primaryCta ? (
              <Button size="lg" className="group h-11 gap-2 rounded-full px-7" render={<Link href={primaryCta.href} />}>
                {primaryCta.label}
                <ArrowUpRight className="size-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" aria-hidden />
              </Button>
            ) : null}
            {secondaryCta ? (
              <Button
                size="lg"
                variant="outline"
                className="h-11 rounded-full bg-card/80 px-6 backdrop-blur hover:bg-card"
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
