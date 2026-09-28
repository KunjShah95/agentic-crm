import * as React from "react"
import Link from "next/link"
import { cn } from "@/lib/utils"

/**
 * The app's button, written from scratch.
 *
 * The three things that separate this from a stock shadcn button, all of them
 * small and all of them deliberate:
 *
 *  1. **The press is a 1px sink, not a scale.** `scale(0.96)` is a toy tell —
 *     it reads as a sticker being pushed. Translating the button down by a
 *     single pixel inside its own box reads as a physical key on a control
 *     panel, and because the element never resizes, nothing reflows around it.
 *  2. **Solid is #0d0d0d, not #000.** Pure black on a white canvas produces a
 *     vibrating edge (the classic "dark halo" from uncalibrated subpixel
 *     antialiasing against pure white). A near-black with a trace of warmth
 *     sits on the page instead of fighting it.
 *  3. **Focus is an outline with an offset, never a ring.** A ring adds a
 *     second, blurrier edge and makes the control look selected rather than
 *     focused. The offset outline draws *around* the control, which is what a
 *     keyboard user needs to see and what a mouse user never sees.
 *
 * The variants are named after what they do on the page, not after a colour, so
 * `solid`/`outline` stay meaningful if the palette moves.
 */

type Variant = "solid" | "outline" | "ghost" | "inverse" | "inverse-outline" | "link"
type Size = "sm" | "md" | "lg" | "icon"

const VARIANTS: Record<Variant, string> = {
  // The primary action. One per view — if two things are solid, neither is.
  solid: cn(
    "bg-[#0d0d0d] text-white",
    "hover:bg-[#262626]",
    // A hairline of the background showing through keeps the button's edge
    // crisp on a white card without needing a shadow.
    "shadow-[inset_0_0_0_1px_rgb(0_0_0/0.14)]"
  ),
  outline: cn(
    "border border-[#d8d8d8] bg-white text-[#0d0d0d]",
    "hover:border-[#0d0d0d] hover:bg-[#fafafa]"
  ),
  ghost: "text-[#3d3d3d] hover:bg-[#0d0d0d]/[0.05] hover:text-[#0d0d0d]",
  // For use on the black surfaces (sidebar, masthead, dark panels).
  inverse: "bg-white text-[#0d0d0d] hover:bg-white/85",
  "inverse-outline": "border border-white/25 text-white hover:border-white/60 hover:bg-white/10",
  link: "text-[#0d0d0d] underline-offset-4 hover:underline",
}

const SIZES: Record<Size, string> = {
  sm: "h-8 gap-1.5 px-3 text-[12.5px]",
  md: "h-9.5 gap-2 px-4 text-[13px]",
  lg: "h-11 gap-2 px-5 text-[14px]",
  icon: "size-9 justify-center",
}

const BASE = cn(
  "relative inline-flex select-none items-center rounded-sm font-bold tracking-[-0.01em]",
  "whitespace-nowrap transition-[background-color,border-color,color,transform] duration-150",
  "[transition-timing-function:var(--ease-out)]",
  // The press. `translate-y-px` on an element whose layout box is unchanged, so
  // neighbouring elements do not shift a pixel when the button is held.
  "active:translate-y-px",
  "disabled:pointer-events-none disabled:opacity-40",
  // `focus-visible` on every variant, and it wins over the hover background so
  // a focused button never looks hovered.
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0d0d0d]",
  "aria-disabled:pointer-events-none aria-disabled:opacity-40"
)

export function Button({
  variant = "solid",
  size = "md",
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant | "inverse-outline"
  size?: Size
}) {
  return <button className={cn(BASE, VARIANTS[variant], SIZES[size], className)} {...props} />
}

/**
 * The same control, as a link. A separate component rather than a `href` union
 * on `Button` because the two elements have genuinely different prop types, and
 * a union would leak `href` onto `<button>` where it silently does nothing.
 */
export function ButtonLink({
  variant = "solid",
  size = "md",
  className,
  ...props
}: React.ComponentProps<typeof Link> & {
  variant?: Variant | "inverse-outline"
  size?: Size
}) {
  return <Link className={cn(BASE, VARIANTS[variant], SIZES[size], className)} {...props} />
}

/**
 * A text link that behaves like a button but has no chrome.
 *
 * Separate from `variant="link"` because the underlined link and the ghost
 * button are used in different places: the underlined one goes in prose, the
 * ghost one goes in a toolbar. Same component would mean a `size` prop that
 * does nothing for one of them.
 */
export function TextLink({
  className,
  children,
  ...props
}: React.ComponentProps<typeof Link>) {
  return (
    <Link
      className={cn(
        "inline-flex items-center gap-1.5 font-bold tracking-[-0.01em] text-[#0d0d0d]",
        "underline-offset-4 transition-colors duration-150 hover:underline",
        className
      )}
      {...props}
    >
      {children}
    </Link>
  )
}
