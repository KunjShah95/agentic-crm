"use client"

import { useEffect, useRef, useSyncExternalStore } from "react"
import { useTheme } from "next-themes"
import { Check, Laptop, Moon, Sun } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

const OPTIONS = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "System", icon: Laptop },
] as const

/** Nothing ever notifies; the store is read once per hydration. */
function subscribeToNothing() {
  return () => {}
}

/**
 * Theme switch.
 *
 * Two details do the real work here:
 *
 * 1. The sun/moon cross-fade uses scale + blur, not a rotate. Rotating makes the
 *    glyph appear to swing, which reads as playful; scale 0.25→1 with a 4px
 *    blur resolving to 0 reads as the icon resolving into focus. Both glyphs
 *    stay mounted so the exit has a subject — toggling `visibility` instead
 *    makes the icon pop out abruptly.
 *
 * 2. Transitions are suppressed for exactly one frame around the swap. A theme
 *    change repaints background, border, color and shadow on nearly every
 *    element simultaneously; without suppression they all cross-fade and the
 *    whole page smears instead of snapping.
 */
export function ModeToggle() {
  const { theme, setTheme, resolvedTheme } = useTheme()
  const frame = useRef<number | null>(null)

  useEffect(() => {
    return () => {
      if (frame.current) cancelAnimationFrame(frame.current)
    }
  }, [])

  function apply(next: string) {
    const root = document.documentElement
    root.classList.add("theme-switching")
    // Force a reflow so the suppression is committed before the browser can
    // paint a single cross-faded frame.
    void root.offsetHeight
    setTheme(next)
    if (frame.current) cancelAnimationFrame(frame.current)
    frame.current = requestAnimationFrame(() => {
      root.classList.remove("theme-switching")
      frame.current = null
    })
  }

  /*
   * Hydration gate, without a `setState` in an effect.
   *
   * The server cannot know which theme resolved, so rendering the sun during SSR
   * and then swapping to the moon on the client is a hydration mismatch. The
   * usual fix is `useState(false)` + `useEffect(() => setMounted(true))`, but
   * that is a setState in an effect body — an extra render pass on every mount,
   * for every visitor, forever.
   *
   * `useSyncExternalStore` with an empty subscribe gets the same guarantee from
   * the store's own contract instead: the server snapshot is `false`, the
   * client snapshot is `true`, and React reconciles the difference during
   * hydration without a cascading render.
   */
  const isHydrated = useSyncExternalStore(
    subscribeToNothing,
    () => true,
    () => false
  )

  const isDark = isHydrated && resolvedTheme === "dark"

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            size="icon"
            aria-label="Change theme"
            className="relative size-8 shrink-0"
          >
            <Sun
              aria-hidden
              className="absolute size-4 text-brand transition-[opacity,transform,filter] duration-200 [transition-timing-function:var(--ease-out)]"
              style={{
                opacity: isDark ? 0 : 1,
                transform: isDark ? "scale(0.25)" : "scale(1)",
                filter: isDark ? "blur(4px)" : "blur(0px)",
              }}
            />
            <Moon
              aria-hidden
              className="absolute size-4 transition-[opacity,transform,filter] duration-200 [transition-timing-function:var(--ease-out)]"
              style={{
                opacity: isDark ? 1 : 0,
                transform: isDark ? "scale(1)" : "scale(0.25)",
                filter: isDark ? "blur(0px)" : "blur(4px)",
              }}
            />
            <span className="sr-only">Change theme</span>
          </Button>
        }
      />
      <DropdownMenuContent align="end" className="min-w-40">
        {OPTIONS.map(({ value, label, icon: Icon }) => (
          <DropdownMenuItem key={value} onClick={() => apply(value)} className="gap-2">
            <Icon className="size-4" />
            <span className="flex-1">{label}</span>
            {isHydrated && theme === value ? (
              <Check className="size-3.5 text-brand" aria-hidden />
            ) : null}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
