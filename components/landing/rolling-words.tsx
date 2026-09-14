"use client"

import { useEffect, useRef, useState } from "react"

/**
 * Headline ticker — cycles a list of words in one slot with a vertical
 * roll + blur, like the kinetic heroes on motion-focused landing pages.
 * Falls back to the first word for reduced-motion users.
 */
export function RollingWords({
  words,
  interval = 2600,
  className,
}: {
  words: string[]
  interval?: number
  className?: string
}) {
  const [index, setIndex] = useState(0)
  const [animate, setAnimate] = useState(false)

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setAnimate(true)
    const id = setInterval(
      () => setIndex((i) => (i + 1) % words.length),
      Math.max(1200, interval)
    )
    return () => clearInterval(id)
  }, [words.length, interval])

  return (
    <span
      className={`relative inline-grid overflow-hidden align-bottom ${className ?? ""}`}
      style={{ height: "1lh" }}
    >
      {/* width reserve: longest word, kept invisible so the headline never jumps */}
      <span aria-hidden className="invisible col-start-1 row-start-1 block">
        {words.reduce((a, b) => (b.length > a.length ? b : a), "")}
      </span>
      <span
        className="col-start-1 row-start-1 will-change-transform"
        style={
          animate
            ? {
                transform: `translateY(calc(${index} * -1lh))`,
                transition: "transform 640ms cubic-bezier(0.16, 1, 0.3, 1)",
              }
            : undefined
        }
      >
        {words.map((w) => (
          <span key={w} className="block leading-[1.15]" style={{ height: "1lh" }}>
            {w}
          </span>
        ))}
      </span>
      {/* screen-reader fallback: current word only */}
      <span className="sr-only" aria-live="polite">
        {words[index]}
      </span>
    </span>
  )
}
