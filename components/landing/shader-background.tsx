"use client"

import { useEffect, useState } from "react"
import { useTheme } from "next-themes"
import dynamic from "next/dynamic"

// WebGL mesh is code-split: the shaders-react lib (WebGL) stays out of the main
// landing bundle and only loads when we actually render the animated variant.
const MeshGradient = dynamic(
  () => import("@paper-design/shaders-react").then((m) => m.MeshGradient),
  { ssr: false },
)

// One signature motion idea for the hero — a slow monochrome mesh.
// Warm off-whites in light, warm near-blacks in dark. No competing accents.
const LIGHT = ["#ffffff", "#f5f3ef", "#eae6df", "#dcd6cb"]
const DARK = ["#0e0e10", "#151416", "#1d1b1f", "#262329"]

// Cheap static fallback used on phones/tablets and for reduced-motion users —
// no WebGL, no GPU animation loop, so no jank and nothing extra to download.
function StaticWash({ className, colors }: { className?: string; colors: string[] }) {
  return (
    <div
      className={className}
      style={{
        width: "100%",
        height: "100%",
        background: `radial-gradient(120% 90% at 20% 0%, ${colors[0]} 0%, ${colors[1]} 40%, ${colors[2]} 70%, ${colors[3]} 100%)`,
      }}
    />
  )
}

export function ShaderBackground({ className }: { className?: string }) {
  const [mounted, setMounted] = useState(false)
  // Default to the cheap path; only opt into WebGL on capable, motion-OK devices.
  const [animate, setAnimate] = useState(false)
  const { resolvedTheme } = useTheme()

  // Hydration guard: canvas is client-only. Syncing mount state to React is the
  // intended use of an effect here.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => {
    setMounted(true)
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    const coarse = window.matchMedia("(pointer: coarse)").matches
    // Skip the animated WebGL mesh on touch devices (phones/tablets) and when
    // the user asked for reduced motion — that's where the jank was reported.
    setAnimate(!reduced && !coarse)
  }, [])

  const colors = resolvedTheme === "dark" ? DARK : LIGHT

  // Before hydration, render the static wash so there's no flash / layout shift.
  if (!mounted || !animate) return <StaticWash className={className} colors={colors} />

  return (
    <MeshGradient
      colors={colors}
      distortion={0.8}
      swirl={0.55}
      grainOverlay={0.06}
      speed={0.14}
      className={className}
      style={{ width: "100%", height: "100%" }}
    />
  )
}
