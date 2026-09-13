"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"

const STORAGE_KEY = "loop-cookie-consent"

type Consent = "accepted" | "essential"

export function CookieBanner() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    // localStorage is the external source of truth for consent; reading it after
    // mount and syncing to state is the intended use of an effect.
    let show = false
    try {
      show = !localStorage.getItem(STORAGE_KEY)
    } catch {
      show = true
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (show) setVisible(true)
  }, [])

  const save = (value: Consent) => {
    try {
      localStorage.setItem(STORAGE_KEY, value)
    } catch {
      /* ignore quota / private mode */
    }
    setVisible(false)
  }

  if (!visible) return null

  return (
    <div
      role="dialog"
      aria-labelledby="cookie-banner-title"
      aria-describedby="cookie-banner-desc"
      className="fixed inset-x-3 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-[70] mx-auto max-w-lg rounded-2xl border bg-card p-4 shadow-e3 sm:inset-x-auto sm:right-4 sm:bottom-4 sm:left-auto md:bottom-6"
    >
      <h2 id="cookie-banner-title" className="text-sm font-semibold tracking-tight">
        Cookies for a smoother loop
      </h2>
      <p id="cookie-banner-desc" className="mt-1.5 text-[13px] leading-5 text-muted-foreground">
        We use essential cookies to keep you signed in, plus optional analytics (Vercel) to improve Estate360.
        See our{" "}
        <Link href="/privacy" className="underline underline-offset-2 hover:text-foreground">
          Privacy Policy
        </Link>
        .
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button size="sm" className="rounded-full" onClick={() => save("accepted")}>
          Accept all
        </Button>
        <Button size="sm" variant="outline" className="rounded-full" onClick={() => save("essential")}>
          Essential only
        </Button>
      </div>
    </div>
  )
}
