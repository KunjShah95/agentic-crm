"use client"

import Link from "next/link"
import { Button } from "@/components/ui/button"
import { ArrowRight } from "lucide-react"
import { GTM_EVENTS, trackEvent } from "@/lib/analytics"

/**
 * The closer: why it was built, then the one action, once more.
 *
 * IMPORTANT: this section once carried testimonials attributed to named people
 * at named companies who were not customers. They were removed, and nothing
 * here may reintroduce them. PROOF states operational change as capability; if
 * real quotes arrive, they belong in their own section with consent on file.
 *
 * Deliberately flat. An earlier pass put this on an inverted panel with a
 * blurred brand bloom and icon chips, and it read as generated: glow plus slab
 * plus chip is the stock "final CTA" template. What carries the weight now is
 * type size, hairline rules and numbered claims, the same materials as the
 * rest of the page.
 */
const PROOF = [
  {
    claim: "Cost sheets and demand notices leave the building in minutes.",
    detail: "Computed from the unit record, not retyped from a spreadsheet.",
  },
  {
    claim: "Site visits verify themselves.",
    detail: "200m GPS check-in, so a visit log can be trusted by Accounts.",
  },
  {
    claim: "Brokers see only their allocation.",
    detail: "The 'who showed that unit' argument stops happening.",
  },
]

export function ManifestoSection({
  isAuthed,
  workspaceSlug,
}: {
  isAuthed: boolean
  workspaceSlug?: string | null
}) {
  const cta = isAuthed && workspaceSlug ? `/${workspaceSlug}/dashboard` : "/signup"

  return (
    <section id="manifesto" className="border-t border-border/70 bg-background">
      <div className="mx-auto grid max-w-[1280px] gap-14 px-6 py-20 lg:grid-cols-[1.05fr_0.95fr] lg:gap-20 lg:px-8 lg:py-28">
        <div>
          <h2 className="font-display text-[34px] font-semibold leading-[1.06] tracking-[-0.03em] text-balance sm:text-[46px]">
            Possession is not luck.
            <br />
            <span className="text-muted-foreground">It is a loop that closes.</span>
          </h2>
          <p className="mt-5 max-w-[46ch] text-[15px] leading-7 text-muted-foreground text-pretty">
            We built Estate360 for NAAR-registered builders in Ahmedabad: two to
            ten sites, one workspace shared by Owners, Sales, Brokers, Site and
            Accounts. Gujarati and Hindi where the buyer reads it. RERA-correct
            where the auditor needs it.
          </p>

          <div className="mt-9 flex flex-wrap items-center gap-x-5 gap-y-3">
            <Button
              variant="brand"
              size="lg"
              className="h-12 gap-2 px-6 text-[15px]"
              render={
                <Link
                  href={cta}
                  onClick={() =>
                    !isAuthed &&
                    trackEvent(GTM_EVENTS.closingStartFree, { location: "closing" })
                  }
                />
              }
            >
              {isAuthed ? "Open your workspace" : "Start your 14-day trial"}
              <ArrowRight className="size-4" aria-hidden />
            </Button>
            <Link
              href="/demo"
              className="tap-target text-[15px] font-medium underline underline-offset-4 hover:text-brand-solid"
            >
              Or book a demo
            </Link>
          </div>

          <p className="mt-5 text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
            No card · Live the same afternoon · Ahmedabad support
          </p>
        </div>

        <ol className="self-center border-t border-foreground">
          {PROOF.map((p, i) => (
            <li
              key={p.claim}
              className="grid grid-cols-[2.25rem_1fr] gap-x-4 border-b border-border/70 py-6"
            >
              <span className="pt-1 text-[12px] font-medium tabular-nums text-muted-foreground">
                0{i + 1}
              </span>
              <div>
                <p className="text-[17px] font-semibold leading-snug tracking-[-0.015em] text-balance">
                  {p.claim}
                </p>
                <p className="mt-1.5 text-[14px] leading-6 text-muted-foreground">{p.detail}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  )
}
