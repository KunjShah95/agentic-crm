"use client"

import Link from "next/link"
import { useSession } from "next-auth/react"
import { Button } from "@/components/ui/button"
import { ArrowRight } from "lucide-react"
import { GTM_EVENTS, trackEvent } from "@/lib/analytics"

export function StickyMobileCta() {
  const { data: session } = useSession()
  const workspaces = (session as { workspaces?: { slug: string }[] } | null)?.workspaces
  const isAuthed = !!session?.user
  const href = isAuthed && workspaces?.[0]?.slug ? `/${workspaces[0].slug}/contacts` : "/signup"

  return (
    /* z-[60] puts this BELOW the cookie banner (z-[70]) rather than above it.
       Previously this sat on top, so a visitor who had not yet chosen a cookie
       preference saw the CTA and the banner occupying the same strip of screen.
       The banner wins because it is a legal decision the visitor has to make and
       it offers two buttons; the CTA is a repeat of something already in the
       header and the hero, so it is the one that yields.

       `--safe-bottom` reserves room for whichever of the two is showing, so the
       footer's last row is never trapped underneath either of them. */
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-[60] p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] md:hidden">
      <div className="pointer-events-auto mx-auto flex max-w-lg items-center gap-2 rounded-md border bg-background/95 p-1.5 pl-4 shadow-e2 backdrop-blur-xl">
        <p className="min-w-0 flex-1 truncate text-[12px] font-medium text-muted-foreground">
          {isAuthed ? "Continue in your workspace" : "14-day free · no card"}
        </p>
        <Button
          variant="brand"
          size="sm"
          className="shrink-0 gap-1 rounded-sm"
          render={
            <Link
              href={href}
              onClick={() =>
                !isAuthed && trackEvent(GTM_EVENTS.stickyStartFree, { location: "sticky_mobile" })
              }
            />
          }
        >
          {isAuthed ? "Open" : "Start free"}
          <ArrowRight className="size-3.5" aria-hidden />
        </Button>
      </div>
    </div>
  )
}
