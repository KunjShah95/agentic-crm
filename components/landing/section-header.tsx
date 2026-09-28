import type { ReactNode } from "react"
import { cn } from "@/lib/utils"

/**
 * One header component for every marketing section.
 *
 * Why this exists: the landing page had seven sections each rolling its own
 * centered eyebrow + centered h2 + centered paragraph. Seven identical headers
 * is the reason the page had no visual hierarchy — every section announced
 * itself at the same volume, so nothing led.
 *
 * Two rules replace that:
 *  1. Alignment alternates by section (see `align` below), so the eye has to
 *     re-anchor each time instead of skating past a repeated template.
 *  2. Eyebrows are rationed. `eyebrow` is opt-in per section, not a default, and
 *     the page currently spends the whole budget on the hero and pricing.
 */
export function SectionHeader({
  eyebrow,
  title,
  body,
  align = "left",
  size = "md",
  className,
}: {
  eyebrow?: string
  title: ReactNode
  body?: ReactNode
  /** "left" for most sections, "center" reserved for at most one mid-page break. */
  align?: "left" | "center"
  /** "md" default, "lg" for the two sections that are meant to lead. */
  size?: "md" | "lg"
  className?: string
}) {
  return (
    <div
      className={cn(
        align === "center" ? "mx-auto max-w-[620px] text-center" : "max-w-[720px]",
        className
      )}
    >
      {eyebrow ? (
        <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-brand">
          {eyebrow}
        </p>
      ) : null}

      <h2
        className={cn(
          "font-display font-semibold text-balance",
          eyebrow ? "mt-3" : "",
          size === "lg"
            ? "text-[34px] leading-[1.06] tracking-[-0.03em] sm:text-[44px]"
            : "text-[28px] leading-[1.1] tracking-[-0.025em] sm:text-[34px]"
        )}
      >
        {title}
      </h2>

      {body ? (
        <p className="mt-4 max-w-[60ch] text-[15px] leading-7 text-muted-foreground text-pretty">
          {body}
        </p>
      ) : null}
    </div>
  )
}
