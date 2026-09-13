"use client"

import { useEffect, useState } from "react"
import { useTheme } from "next-themes"
import { MeshGradient } from "@paper-design/shaders-react"

// One signature motion idea for the hero — a slow monochrome mesh.
// Warm off-whites in light, warm near-blacks in dark. No competing accents.
const LIGHT = ["#ffffff", "#f5f3ef", "#eae6df", "#dcd6cb"]
const DARK = ["#0e0e10", "#151416", "#1d1b1f", "#262329"]

export function ShaderBackground({ className }: { className?: string }) {
  const [mounted, setMounted] = useState(false)
  const { resolvedTheme } = useTheme()
  // Hydration guard: canvas is client-only. Syncing mount state to React is the
  // intended use of an effect here.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setMounted(true), [])

  // Avoid hydration mismatch: canvas only renders client-side.
  if (!mounted) return null

  const reduced = typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches
  const colors = resolvedTheme === "dark" ? DARK : LIGHT

  return (
    <MeshGradient
      colors={colors}
      distortion={0.8}
      swirl={0.55}
      grainOverlay={0.06}
      speed={reduced ? 0 : 0.14}
      className={className}
      style={{ width: "100%", height: "100%" }}
    />
  )
}
