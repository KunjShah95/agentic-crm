"use client"

import { track } from "@vercel/analytics"

export const CONSENT_STORAGE_KEY = "estate360-cookie-consent"
export const CONSENT_EVENT = "estate360:consent"

export type Consent = "accepted" | "essential"

export function getConsent(): Consent | null {
  if (typeof window === "undefined") return null
  try {
    const raw = window.localStorage.getItem(CONSENT_STORAGE_KEY)
    return raw === "accepted" || raw === "essential" ? raw : null
  } catch {
    return null
  }
}

export function setConsent(value: Consent) {
  try {
    window.localStorage.setItem(CONSENT_STORAGE_KEY, value)
  } catch {
    /* private mode / quota — the banner reappears next visit, which is safe */
  }
  window.dispatchEvent(new Event(CONSENT_EVENT))
}

/**
 * One funnel, one name. Every growth-meaningful action on the site goes through
 * here so the Vercel Analytics dashboard reads as a single funnel instead of a
 * list of one-off event names. Events are dropped unless the visitor explicitly
 * accepted optional analytics in the cookie banner — the banner's promise and
 * the actual tagging behavior now have to stay the same code path.
 */
export const GTM_EVENTS = {
  headerStartFree: "cta_header_start_free",
  heroStartFree: "cta_hero_start_free",
  stickyStartFree: "cta_sticky_start_free",
  pricingStartFree: "cta_pricing_start_free",
  pricingContact: "cta_pricing_contact",
  closingStartFree: "cta_closing_start_free",
  contactSubmit: "contact_submit",
  signupCompleted: "signup_completed",
} as const

export function trackEvent(
  name: (typeof GTM_EVENTS)[keyof typeof GTM_EVENTS],
  props?: Record<string, string | number | boolean | null>
) {
  if (getConsent() !== "accepted") return
  track(name, props)
  // Mirror the same event into any paid-media tags that loaded through
  // <AdTags />. Conversion names are mapped to the ad platforms' standard
  // events so ad accounts optimize on something meaningful instead of a raw
  // string. Everything else goes as a custom event.
  if (typeof window === "undefined") return
  if (name === GTM_EVENTS.contactSubmit || name === GTM_EVENTS.signupCompleted) {
    window.fbq?.("track", name === GTM_EVENTS.contactSubmit ? "Lead" : "CompleteRegistration")
    window.gtag?.("event", name === GTM_EVENTS.contactSubmit ? "generate_lead" : "sign_up", props ?? {})
  } else {
    window.fbq?.("trackCustom", name, props ?? {})
    window.gtag?.("event", name, props ?? {})
  }
}
