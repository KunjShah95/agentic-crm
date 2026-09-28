import { cn } from "@/lib/utils"

/**
 * The Estate360 mark.
 *
 * Drawn as a floor stack: three slabs of decreasing width, left-aligned, with
 * the top one closed off. It reads three ways at the sizes it is used —
 * a tower, a funnel, and a bar chart — which is exactly the product: inventory
 * narrowing into deals. The alternative marks that were on the table (a house
 * outline, a broken "loop" ring, an "E") all announce one of those three
 * readings and none of the others, and a broken ring in particular reads as a
 * spinner.
 *
 * The wordmark splits the two allowed weights on purpose: `Estate` at 400 and
 * `360` at 700, with a dot between them as a full stop. The weight break lands
 * the eye on the number, which is the part of the name that carries the
 * promise.
 */

export function LogoMark({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "flex size-8 shrink-0 items-center justify-center rounded-sm",
        "bg-white text-[#1a1a1a]",
        className
      )}
      aria-hidden
    >
      <svg viewBox="0 0 24 24" className="size-[18px]" fill="none">
        {/* three slabs, widths 100 / 70 / 44 of the 16-unit field */}
        <rect x="4" y="6" width="16" height="3" rx="1.5" fill="currentColor" />
        <rect x="4" y="11" width="11" height="3" rx="1.5" fill="currentColor" opacity="0.62" />
        <rect x="4" y="16" width="6" height="3" rx="1.5" fill="currentColor" opacity="0.34" />
      </svg>
    </span>
  )
}

export function Logo({
  className,
  /** Hide the wordmark — used when the rail is collapsed to icons only. */
  markOnly = false,
}: {
  className?: string
  markOnly?: boolean
}) {
  if (markOnly) return <LogoMark className={className} />

  return (
    <span className={cn("flex items-center gap-2.5", className)}>
      <LogoMark />
      <span className="flex items-baseline text-[15px] leading-none tracking-[-0.03em] text-white">
        <span className="font-normal">Estate</span>
        <span className="px-[1.5px] font-normal opacity-45">.</span>
        <span className="font-bold">360</span>
      </span>
    </span>
  )
}
