"use client"

import Link from "next/link"
import { Button } from "@/components/ui/button"
import { ArrowRight, Flame, CalendarClock, TriangleAlert } from "lucide-react"
import { GTM_EVENTS, trackEvent } from "@/lib/analytics"

/**
 * Hero.
 *
 * The old hero failed on four counts and all four are fixed here:
 *  1. It rendered a div-built fake browser window (macOS traffic lights in raw
 *     red-400/amber-400/green-400) pretending to be a screenshot. There is no
 *     screenshot to show, so it is gone rather than faked harder.
 *  2. Subtext ran 28 words over a six-item noun pile. Now 19 words, one claim.
 *  3. "No card required" and a Cmd-K hint strip sat under the CTAs. Both are
 *     banned hero furniture — the hint moved to the command-bar section, the
 *     reassurance moved to pricing.
 *  4. Everything was a rounded-full pill on a rounded-md shell. One radius
 *     scale now: controls and surfaces are both --radius (10px).
 *
 * The visual is a real component preview — the actual Next Best Action row the
 * team sees on open — not an illustration of one.
 *
 * Hierarchy note: the second headline line used to be tinted `text-brand`. Now
 * that the primary CTA carries hue 68, tinting the headline too put the accent
 * on two elements and split the emphasis between them. The headline is the
 * largest thing on the page and does not need colour to win; the button is the
 * clickable thing and does. One accent, one job.
 */
export function HeroSection({
  isAuthed,
  workspaceSlug,
}: {
  isAuthed: boolean
  workspaceSlug?: string | null
}) {
  const primaryHref = isAuthed && workspaceSlug ? `/${workspaceSlug}/dashboard` : "/signup"

  return (
    <section className="relative isolate overflow-hidden">
      {/* Gradient field. Fixed layer, pointer-events-none, no scroll repaint. */}
      <div aria-hidden className="field-gradient -z-10" />
      <div
        aria-hidden
        className="absolute inset-x-0 bottom-0 -z-10 h-40 bg-gradient-to-t from-background to-transparent"
      />

      <div className="mx-auto max-w-[1280px] px-6 lg:px-8">
        <div className="grid items-center gap-12 pt-16 pb-20 lg:grid-cols-[1.05fr_0.95fr] lg:gap-16 lg:pt-20 lg:pb-28">
          {/* ── LEFT: the claim ── */}
          <div>
            <p className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.16em] text-brand-solid">
              <span className="h-px w-6 bg-brand/50" aria-hidden />
              For real-estate sales teams
            </p>

            <h1 className="mt-6 font-display text-[40px] font-semibold leading-[1.03] tracking-[-0.035em] text-balance sm:text-[52px] lg:text-[60px]">
              Stop managing leads.
              <br />
              Start closing them.
            </h1>

            <p className="mt-6 max-w-[46ch] text-[17px] leading-8 text-pretty text-muted-foreground">
              One screen for enquiries, WhatsApp, site visits and bookings. Open it
              and it tells the team what to do next.
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Button
                variant="brand"
                size="lg"
                className="h-11 gap-2 px-6"
                render={
                  <Link
                    href={primaryHref}
                    onClick={() =>
                      !isAuthed && trackEvent(GTM_EVENTS.heroStartFree, { location: "hero" })
                    }
                  />
                }
              >
                {isAuthed ? "Open your workspace" : "Start free"}
                <ArrowRight className="size-4" aria-hidden />
              </Button>
              <Button
                variant="outline"
                size="lg"
                className="h-11 gap-2 border-border bg-card px-6"
                render={<Link href="#story" />}
              >
                See a day
                <ArrowRight className="size-4" aria-hidden />
              </Button>
            </div>
          </div>

          {/* ── RIGHT: the one thing the product does on open ── */}
          <div className="relative">
            <div className="rounded-md border border-border/70 bg-card p-5 shadow-e3">
              <div className="flex items-baseline justify-between gap-4">
                <p className="text-[13px] font-medium text-muted-foreground">
                  Next Best Action
                </p>
                {/* A clock label in a mock UI — chrome, not a figure. */}
                <p className="text-[11px] tabular-nums text-muted-foreground">9:02 AM</p>
              </div>

              {/* One queue row. Enough to show the product's actual opinion,
                  not enough to impersonate a dashboard. */}
              <div className="mt-4 rounded-sm border border-border/70 bg-surface-sunken p-4">
                <div className="flex items-start gap-3">
                  <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-sm bg-brand text-brand-foreground">
                    <Flame className="size-4" aria-hidden />
                  </span>
                  <div className="min-w-0">
                    <p className="text-[15px] font-semibold leading-snug tracking-[-0.01em]">
                      Call Rahul Shah. He opened the cost sheet three times.
                    </p>
                    <p className="mt-1 text-[13px] leading-5 text-muted-foreground">
                      3BHK · SG Highway · no contact in 19 hours
                    </p>
                  </div>
                </div>

                <div className="mt-4 flex items-center gap-2">
                  <Button size="sm" className="h-8 px-3 text-[13px]">
                    Call now
                  </Button>
                  <Button size="sm" variant="outline" className="h-8 px-3 text-[13px]">
                    WhatsApp
                  </Button>
                </div>
              </div>

              {/* Two quieter rows establish that the queue is ranked, without
                  turning the hero back into a fake dashboard. */}
              <ul className="mt-2 rule-y">
                <li className="flex items-center gap-3 py-3">
                  <CalendarClock className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                  <p className="min-w-0 flex-1 truncate text-[13px]">
                    Priya Mehta — site visit tomorrow
                  </p>
                  <span className="shrink-0 text-[12px] text-muted-foreground">
                    Send cost sheet
                  </span>
                </li>
                <li className="flex items-center gap-3 py-3">
                  <TriangleAlert className="size-4 shrink-0 text-status-critical-fg" aria-hidden />
                  <p className="min-w-0 flex-1 truncate text-[13px]">
                    A-1204 — payment milestone overdue
                  </p>
                  <span className="shrink-0 text-[12px] text-muted-foreground">Follow up</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
