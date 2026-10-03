"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import {
  CONSENT_STORAGE_KEY,
  setConsent,
  type Consent,
} from "@/lib/analytics"

export function CookieBanner() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    // localStorage is the external source of truth for consent; reading it after
    // mount and syncing to state is the intended use of an effect.
    let show = false
    try {
      show = !localStorage.getItem(CONSENT_STORAGE_KEY)
    } catch {
      show = true
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (show) setVisible(true)
  }, [])

  const save = (value: Consent) => {
    setConsent(value)
    setVisible(false)
  }

  if (!visible) return null

  return (
    /* Position is the whole argument here. This started as a bottom sheet, which
       on a 375px screen sat directly over the footer's nav, email and phone links
       and swallowed every tap aimed at them — measured, not suspected. It then
       became a full-screen modal, which fixed the footer but made the entire page
       inert until a choice was made; too strong a penalty for a banner that only
       gates optional analytics.

       It now sits just BELOW the sticky header rather than over it. Anchoring to
       the top edge itself was worse than either earlier attempt: it covered the
       wordmark and the home link on every page, which is the one control that
       must never be unreachable — a visitor who cannot tap the logo cannot get
       out of the site without using the back button. `4.25rem` clears the 64px
       sticky header plus its own padding.

       So the three constraints are now separated rather than traded against each
       other: sticky header owns the very top, cookie card sits under it, sticky
       CTA owns the bottom, and the footer has clearance padding to clear the CTA.

       `sm:` and up returns to the bottom-right corner card, because from that
       width the sticky CTA no longer renders and that corner is free again. */
    <div
      className="fixed inset-x-0 top-[calc(env(safe-area-inset-top)+4.25rem)] z-[70] flex justify-center p-3 sm:inset-auto sm:bottom-4 sm:right-4 sm:top-auto sm:block sm:p-0"
    >
      <div
        role="dialog"
        aria-modal="false"
        aria-labelledby="cookie-banner-title"
        aria-describedby="cookie-banner-desc"
        className="mx-auto w-full max-w-lg rounded-md border bg-card p-4 shadow-e3 sm:w-auto"
      >
        <h2 id="cookie-banner-title" className="text-sm font-semibold tracking-tight">
          Cookies that keep Estate360 running smoothly
        </h2>
        <p id="cookie-banner-desc" className="mt-1.5 text-[13px] leading-5 text-muted-foreground">
          We use essential cookies to keep you signed in, plus optional analytics (Vercel) to improve Estate360.
          See our{" "}
          <Link href="/privacy" className="tap-target underline underline-offset-2 hover:text-foreground">
            Privacy Policy
          </Link>
          .
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button variant="brand" size="sm" className="h-10 rounded-md px-4" onClick={() => save("accepted")}>
            Accept all
          </Button>
          <Button size="sm" variant="outline" className="h-10 rounded-md px-4" onClick={() => save("essential")}>
            Essential only
          </Button>
        </div>
      </div>
    </div>
  )
}
