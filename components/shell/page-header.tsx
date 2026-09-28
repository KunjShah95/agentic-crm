import * as React from "react"
import { Separator } from "@/components/ui/separator"
import { cn } from "@/lib/utils"

/**
 * The one page header in the app.
 *
 * It is a bordered card rather than free-floating text because every module
 * below it is also a bordered card — a header that breaks the grid reads as a
 * different kind of screen, and the eye stops trusting that the page has a
 * structure.
 */
export function PageHeader({
  title,
  description,
  badge,
  actions,
  stats,
  className,
}: {
  title: React.ReactNode
  description?: React.ReactNode
  badge?: React.ReactNode
  actions?: React.ReactNode
  stats?: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn("rounded-md border bg-card", className)}>
      <div className="p-5 md:p-6">
        {/*
          `items-start` puts the action cluster on the title's baseline group
          rather than centring it against a 30px heading — a 32px button
          centred beside a 30px title reads as floating, because the optical
          centre of the pair is neither element's centre.
        */}
        <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-3">
          <div className="min-w-0 space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              {/*
                The one place Fraunces is allowed at heading weight: a single
                page-level h1 per screen. Every other title in the app is sans,
                because a 13px serif reads as a rendering error rather than a
                deliberate choice.
              */}
              <h1 className="text-balance font-display text-[30px] font-medium leading-[1.1] tracking-[-0.025em]">
                {title}
              </h1>
              {badge ? <span className="inline-flex">{badge}</span> : null}
            </div>
            {description ? (
              <p className="max-w-[68ch] text-balance text-[13px] leading-relaxed text-muted-foreground">
                {description}
              </p>
            ) : null}
          </div>
          {actions ? (
            <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>
          ) : null}
        </div>
        {stats ? (
          <>
            <Separator className="my-4" />
            {/*
              `auto-rows-fr` holds every tile to the same height regardless of
              how much sub-text one of them carries, so a single tile with two
              lines of `sub` cannot make the stat band look ragged.
            */}
            <div className="grid auto-rows-fr gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {stats}
            </div>
          </>
        ) : null}
      </div>
    </div>
  )
}

/**
 * One tile in the header's stat band.
 *
 * The numeral is Fraunces — the second of its two sanctioned jobs. The label
 * above it is sans at 11.5px, so the two never compete: the value reads first,
 * the label is the caption.
 */
export function Stat({
  label,
  value,
  sub,
  icon,
  href,
  tone = "neutral",
}: {
  label: string
  value: React.ReactNode
  sub?: string
  icon?: React.ReactNode
  /** Makes the whole tile a link — the dashboard's tiles navigate. */
  href?: string
  tone?: "neutral" | "positive" | "caution" | "critical"
}) {
  const toneClass = {
    neutral: "text-foreground",
    positive: "text-status-positive-fg",
    caution: "text-status-caution-fg",
    critical: "text-status-critical-fg",
  }[tone]

  const body = (
    <>
      <div className="flex items-center gap-1.5 text-[11.5px] font-medium leading-4 text-muted-foreground">
        {icon}
        <span className="truncate">{label}</span>
      </div>
      <div
        className={cn(
          "mt-1.5 font-display text-[28px] font-medium leading-none tracking-[-0.02em] tabular-nums",
          toneClass
        )}
      >
        {value}
      </div>
      {sub ? <div className="mt-1.5 text-[11.5px] leading-4 text-muted-foreground">{sub}</div> : null}
    </>
  )

  const className =
    "rounded-md border bg-card px-3.5 py-3 transition-colors duration-150"

  if (href) {
    return (
      <a
        href={href}
        // Border darkens on hover rather than gaining a shadow. Under Direction
        // A a shadow here would read as an overlay, and nothing on this page is
        // an overlay.
        className={cn(className, "block hover:border-foreground/20")}
      >
        {body}
      </a>
    )
  }

  return <div className={className}>{body}</div>
}
