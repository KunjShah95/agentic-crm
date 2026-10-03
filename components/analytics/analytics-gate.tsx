"use client"

import { useSyncExternalStore } from "react"
import { Analytics } from "@vercel/analytics/next"
import { SpeedInsights } from "@vercel/speed-insights/next"
import { CONSENT_EVENT, getConsent } from "@/lib/analytics"

function subscribe(onChange: () => void) {
  window.addEventListener(CONSENT_EVENT, onChange)
  window.addEventListener("storage", onChange)
  return () => {
    window.removeEventListener(CONSENT_EVENT, onChange)
    window.removeEventListener("storage", onChange)
  }
}

/**
 * The cookie banner promises "optional analytics (Vercel)". Rendering
 * <Analytics /> unconditionally broke that promise — the tag fired even for
 * "Essential only". This gate loads Vercel Analytics and Speed Insights only
 * after an explicit "Accept all", and reacts the moment the choice is made.
 */
export function AnalyticsGate() {
  const enabled = useSyncExternalStore(
    subscribe,
    () => getConsent() === "accepted",
    () => false
  )
  if (!enabled) return null
  return (
    <>
      <Analytics />
      <SpeedInsights />
    </>
  )
}
