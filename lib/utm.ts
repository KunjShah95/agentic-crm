"use client"

const STORAGE_KEY = "estate360-utm"
const PARAMS = ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content", "gclid", "fbclid"] as const

export type UtmData = Partial<Record<(typeof PARAMS)[number], string>>

/**
 * First-touch attribution. The first page load that carries UTM (or ad-click)
 * params wins and is kept for the session; later navigations without params
 * never overwrite it. Query strings are the only place ad platforms tell us
 * where a lead came from, so this has to be captured before the data is lost
 * to client-side navigation.
 */
export function captureUtm(): UtmData {
  if (typeof window === "undefined") return {}
  try {
    const params = new URLSearchParams(window.location.search)
    const incoming: UtmData = {}
    for (const key of PARAMS) {
      const value = params.get(key)
      if (value) incoming[key] = value.slice(0, 120)
    }
    if (Object.keys(incoming).length > 0) {
      window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(incoming))
      return incoming
    }
    const stored = window.sessionStorage.getItem(STORAGE_KEY)
    return stored ? (JSON.parse(stored) as UtmData) : {}
  } catch {
    return {}
  }
}

export function getUtm(): UtmData {
  if (typeof window === "undefined") return {}
  try {
    const stored = window.sessionStorage.getItem(STORAGE_KEY)
    return stored ? (JSON.parse(stored) as UtmData) : {}
  } catch {
    return {}
  }
}
