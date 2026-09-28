import * as React from "react"

import { cn } from "@/lib/utils"

/**
 * The page header, in two tones.
 *
 * `ink` is the black band. It exists because a page whose only dark surface is
 * the rail reads as two unrelated halves, and because on a monochrome canvas a
 * single solid block is the only thing that can carry a headline at scale
 * without a colour to lean on. It is the same near-black as the sidebar, which
 * is what makes the shell read as one object.
 *
 * `paper` is the same structure without the fill: a title, a rule, and a row of
 * figures under it. Used on pages whose real content is a list — a black band
 * above a list of cards is two competing containers.
 *
 * The figure row is the part worth stealing. Numbers do not each get a card;
 * they share one strip and are separated by vertical hairlines. A card per
 * number is the generic dashboard move, and it is why those screens look like
 * tiles: the eye gets five equally-weighted objects and no hierarchy at all.
 */

export type MastheadFigure = {
  label: string
  value: React.ReactNode
  /** Secondary line under the value. Omit for a clean two-line cell. */
  sub?: string
  href?: string
}

export function Masthead({
  eyebrow,
  title,
  description,
  actions,
  figures,
  tone = "ink",
  className,
}: {
  eyebrow?: React.ReactNode
  title: React.ReactNode
  description?: React.ReactNode
  actions?: React.ReactNode
  figures?: MastheadFigure[]
  tone?: "ink" | "paper"
  className?: string
}) {
  const ink = tone === "ink"

  return (
    <div
      className={cn(
        "overflow-hidden rounded-md",
        ink ? "bg-[#0d0d0d] text-white" : "border border-[#e6e6e6] bg-white text-[#0d0d0d]",
        className
      )}
    >
      <div className="px-5 pt-5 pb-4 md:px-6">
        <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-4">
          <div className="min-w-0 space-y-2">
            {eyebrow ? (
              <div
                className={cn(
                  "flex items-center gap-2 text-[10px] leading-4 font-bold tracking-[0.13em] uppercase",
                  ink ? "text-white/45" : "text-[#8a8a8a]"
                )}
              >
                {eyebrow}
              </div>
            ) : null}

            {/* 30px at -0.035em. The tracking is doing real work here: at this
                size Inter's default spacing leaves visible gaps between
                letter pairs, and a headline is the one place the eye is
                sensitive enough to notice. */}
            <h1 className="text-[30px] leading-[1.05] font-bold tracking-[-0.035em] text-balance">
              {title}
            </h1>

            {description ? (
              <p
                className={cn(
                  "max-w-[62ch] text-[13px] leading-relaxed tracking-[-0.005em] text-pretty",
                  ink ? "text-white/55" : "text-[#787878]"
                )}
              >
                {description}
              </p>
            ) : null}
          </div>

          {actions ? (
            <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>
          ) : null}
        </div>
      </div>

      {figures?.length ? (
        <div
          className={cn(
            "grid grid-cols-2 gap-px border-t sm:grid-cols-3 lg:grid-cols-5",
            // `gap-px` on a coloured background draws the dividers with the
            // container's own colour showing through the gap. One rule, no
            // per-cell borders, and no 1px seams where borders would meet.
            ink ? "border-white/12 bg-white/12" : "border-[#ededed] bg-[#ededed]"
          )}
        >
          {figures.map((f) => {
            const cell = (
              <>
                <span
                  className={cn(
                    "text-[10px] leading-4 font-bold tracking-[0.12em] uppercase",
                    ink ? "text-white/40" : "text-[#9a9a9a]"
                  )}
                >
                  {f.label}
                </span>
                <span
                  className={cn(
                    "mt-1 block text-[24px] leading-none font-bold tracking-[-0.03em] tabular-nums",
                    ink ? "text-white" : "text-[#0d0d0d]"
                  )}
                >
                  {f.value}
                </span>
                {f.sub ? (
                  <span
                    className={cn(
                      "mt-1.5 block text-[11.5px] leading-4 tracking-[-0.005em]",
                      ink ? "text-white/40" : "text-[#8a8a8a]"
                    )}
                  >
                    {f.sub}
                  </span>
                ) : null}
              </>
            )

            const cellClass = cn(
              "block px-4 py-3.5 transition-colors duration-150 md:px-5",
              ink ? "hover:bg-white/[0.06]" : "hover:bg-[#fcfcfc]"
            )

            return f.href ? (
              <a key={f.label} href={f.href} className={cn(cellClass, "cursor-pointer")}>
                {cell}
              </a>
            ) : (
              <div key={f.label} className={cellClass}>
                {cell}
              </div>
            )
          })}
        </div>
      ) : null}
    </div>
  )
}
