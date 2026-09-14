"use client"

import { useEffect, useRef, useState } from "react"

/**
 * Mouse-tracked spotlight that reveals a wireframe "blueprint grid" underneath
 * the hero — the construction-site metaphor made interactive. Pure CSS mask
 * (no canvas), so it costs one rAF-throttled custom-property write per frame
 * and disappears entirely for reduced-motion users and before hydration.
 */
export function SpotlightGrid({ className }: { className?: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const [enabled, setEnabled] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return
    if (window.matchMedia("(pointer: coarse)").matches) return

    let raf = 0
    const onMove = (e: MouseEvent) => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(() => {
        const rect = el.getBoundingClientRect()
        el.style.setProperty("--sx", `${e.clientX - rect.left}px`)
        el.style.setProperty("--sy", `${e.clientY - rect.top}px`)
      })
    }
    // Keep the wash alive when the pointer leaves — park it off-canvas.
    const onLeave = () => {
      el.style.setProperty("--sx", "-999px")
      el.style.setProperty("--sy", "-999px")
    }

    setEnabled(true)
    window.addEventListener("mousemove", onMove, { passive: true })
    el.addEventListener("mouseleave", onLeave)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener("mousemove", onMove)
      el.removeEventListener("mouseleave", onLeave)
    }
  }, [])

  return (
    <div
      ref={ref}
      aria-hidden
      className={`pointer-events-none absolute inset-0 ${enabled ? "" : "hidden"} ${className ?? ""}`}
      style={{ ["--sx" as string]: "-999px", ["--sy" as string]: "-999px" }}
    >
      {/* fine drafting grid + coarse site-plan grid, masked to a soft disc */}
      <div
        className="absolute inset-0 opacity-70 transition-opacity duration-500 dark:opacity-90"
        style={{
          backgroundImage:
            "linear-gradient(to right, color-mix(in oklab, var(--brand) 26%, transparent) 1px, transparent 1px)," +
            "linear-gradient(to bottom, color-mix(in oklab, var(--brand) 26%, transparent) 1px, transparent 1px)," +
            "linear-gradient(to right, color-mix(in oklab, var(--foreground) 9%, transparent) 1px, transparent 1px)," +
            "linear-gradient(to bottom, color-mix(in oklab, var(--foreground) 9%, transparent) 1px, transparent 1px)",
          backgroundSize: "144px 144px, 144px 144px, 18px 18px, 18px 18px",
          maskImage:
            "radial-gradient(340px circle at var(--sx) var(--sy), black 0%, rgba(0,0,0,0.55) 45%, transparent 75%)",
          WebkitMaskImage:
            "radial-gradient(340px circle at var(--sx) var(--sy), black 0%, rgba(0,0,0,0.55) 45%, transparent 75%)",
        }}
      />
      {/* the cursor dot itself */}
      <div
        className="absolute size-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-brand/80 shadow-[0_0_24px_6px_color-mix(in_oklab,var(--brand)_35%,transparent)]"
        style={{ left: "var(--sx)", top: "var(--sy)" }}
      />
    </div>
  )
}
