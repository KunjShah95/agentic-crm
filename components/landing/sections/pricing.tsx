"use client"

import Link from "next/link"
import { Button } from "@/components/ui/button"
import { SectionHeader } from "@/components/landing/section-header"
import { cn } from "@/lib/utils"
import { ArrowRight, Check, CreditCard } from "lucide-react"
import { GTM_EVENTS, trackEvent } from "@/lib/analytics"

/**
 * Pricing.
 *
 * The section opened straight into three cards with no heading at all — a
 * hierarchy break and an a11y/SEO gap, since pricing had no h2 anywhere on the
 * page. It now has a header like every other section.
 *
 * Also fixed: the "14-day free · cancel anytime" line repeated under all three
 * plans is one fact said three times. It now appears once, in the billing bar,
 * which already states it. Buttons moved off pills to match the page's single
 * radius scale.
 */
const PLANS = [
  {
    name: "Builder",
    price: "₹1,499",
    note: "per month · 1 project",
    pitch: "One site, enquiry through to possession.",
    features: [
      "1 workspace · 1 project",
      "Unlimited contacts and deals",
      "Cost sheets and RERA documents",
      "GPS check-in and WhatsApp inbox",
    ],
  },
  {
    name: "Team",
    price: "₹3,999",
    note: "per month · up to 6 staff",
    pitch: "Sales, Accounts and Site on the same loop.",
    features: [
      "3 workspaces · Owners, Sales, Brokers",
      "Owner, Admin, Sales, Broker, Viewer roles",
      "Invites, broker scope filter, CLP milestones",
      "NAAR association pool trial · gu / hi",
    ],
    featured: true,
  },
  {
    name: "Network",
    price: "₹7,999",
    note: "per month · up to 12 staff · multi-site",
    pitch: "Two to ten projects without a spreadsheet.",
    features: [
      "Unlimited projects and buyer portal",
      "Public sites with enquiry to scored lead",
      "UPI collection and Tally / PDF export",
      "Association exchange and referral ledger",
    ],
  },
]

export function PricingSection({
  isAuthed,
  workspaceSlug,
}: {
  isAuthed: boolean
  workspaceSlug?: string | null
}) {
  /**
   * Where "Start free" actually goes.
   *
   * This was hardcoded to `/contact` while every other landing section built the
   * same href from the session: `isAuthed && workspaceSlug ? /${slug}/dashboard :
   * "/signup"` in `hero.tsx`, `site-header.tsx`, `wins.tsx` and `site-footer.tsx`.
   * So the pricing table — the section where a visitor is closest to converting —
   * was the one place the button did not do what its label said. An anonymous
   * visitor clicked "Start free" and got a sales enquiry form; a signed-in one was
   * sent to a contact form instead of back into the product they already had a
   * workspace for. `workspaceSlug` was passed in from `landing-client.tsx` and
   * never read, which is the tell that this was left behind rather than chosen.
   *
   * `/contact` still has its own entry points — the header and footer links to it
   * directly — so nothing becomes unreachable by fixing this.
   */
  const cta = isAuthed && workspaceSlug ? `/${workspaceSlug}/dashboard` : "/signup"

  return (
    <section id="pricing" className="border-t border-border/70 bg-background">
      <div className="mx-auto max-w-[1280px] px-6 py-20 lg:px-8 lg:py-28">
        <SectionHeader
          eyebrow="Pricing"
          title="Three plans. Per workspace, not per seat."
          body="Every plan includes the full daily loop. The difference is how many workspaces and how many people run on it."
        />

        <div className="mt-12 grid items-start gap-4 lg:grid-cols-3">
          {PLANS.map((p) => (
            <div
              key={p.name}
              className={cn(
                "relative flex min-w-0 flex-col rounded-md border p-6",
                p.featured
                  ? "border-foreground bg-foreground text-background lg:-translate-y-3"
                  : "border-border/70 bg-card"
              )}
            >
              {p.featured ? (
                <span className="absolute -top-2.5 left-6 rounded-sm border border-foreground bg-background px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.14em] text-foreground">
                  Most chosen
                </span>
              ) : null}

              <p
                className={cn(
                  "text-[11px] font-medium uppercase tracking-[0.14em]",
                  p.featured ? "text-background/60" : "text-muted-foreground"
                )}
              >
                {p.name}
              </p>

              <div className="mt-2 flex flex-wrap items-baseline gap-x-2 gap-y-1">
                <span className="font-display text-[38px] font-semibold leading-none tracking-[-0.03em] tabular-nums">
                  {p.price}
                </span>
                <span
                  className={cn(
                    "text-[12px]",
                    p.featured ? "text-background/60" : "text-muted-foreground"
                  )}
                >
                  {p.note}
                </span>
              </div>

              <p
                className={cn(
                  "mt-4 border-l-2 pl-3 text-[13px] leading-5",
                  p.featured
                    ? "border-background/40 text-background/75"
                    : "border-border text-muted-foreground"
                )}
              >
                {p.pitch}
              </p>

              <ul
                className={cn(
                  "mt-6 flex-1 space-y-2.5 text-[13px]",
                  p.featured ? "text-background/85" : "text-muted-foreground"
                )}
              >
                {p.features.map((f) => (
                  <li key={f} className="flex items-start gap-2.5">
                    <span
                      className={cn(
                        "mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-xs",
                        p.featured ? "bg-background text-foreground" : "bg-muted text-foreground"
                      )}
                    >
                      <Check className="size-2.5" aria-hidden />
                    </span>
                    <span className="leading-5">{f}</span>
                  </li>
                ))}
              </ul>

              <Button
                variant="brand"
                className="mt-7 w-full gap-1.5"
                render={
                  <Link
                    href={cta}
                    /* Only the anonymous path is tracked. The event is named
                       `pricingStartFree`, and for an already-signed-in visitor
                       this button no longer starts a trial — it re-enters an
                       existing workspace. Counting those inflates the signup
                       number with users who signed up earlier. */
                    onClick={() =>
                      !isAuthed &&
                      trackEvent(GTM_EVENTS.pricingStartFree, { plan: p.name })
                    }
                  />
                }
              >
                {isAuthed ? "Open your workspace" : "Start free"}
                <ArrowRight
                  className="size-4 transition-transform group-hover:translate-x-0.5"
                  aria-hidden
                />
              </Button>

              {/*
                A card has one action, and the plan above it is a price. Some
                visitors cannot decide from a price alone — migration from a
                spreadsheet, per-project cost, or whether the trial needs a card —
                and the only place they can ask is a person. Previously that
                option existed only in the page hero and below the FAQ, so the
                decision point itself (the card) offered no way out except
                signing up. `/contact` is reached from the header, footer and both
                hero CTAs, so nothing about its reachability changes here.
              */}
              <Link
                href="/contact"
                onClick={() => trackEvent(GTM_EVENTS.pricingContact, { plan: p.name })}
                className={cn(
                  "tap-target mt-3 text-center text-[13px] underline underline-offset-4 transition-colors",
                  p.featured
                    ? "text-background/70 hover:text-background"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                Questions about {p.name}? Ask us
              </Link>
            </div>
          ))}
        </div>

        <div className="mt-6 flex flex-col gap-3 rounded-md border border-border/70 bg-surface-sunken p-5 sm:flex-row sm:items-center sm:justify-between">
          <span className="flex items-center gap-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-sm bg-brand text-brand-foreground">
              <CreditCard className="size-4" aria-hidden />
            </span>
            <span className="text-[14px] font-medium">
              ₹0 today. Billing starts after your 14-day trial.
            </span>
          </span>
          <span className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-muted-foreground">
            <span>Cancel anytime</span>
            <span aria-hidden>·</span>
            <span>CSV export included</span>
            <span aria-hidden>·</span>
            <span>Secure billing</span>
          </span>
        </div>
      </div>
    </section>
  )
}
