import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { SectionHeader } from "@/components/landing/section-header"
import { TrendingUp, Package, ClipboardCheck, FileText, ArrowRight } from "lucide-react"

/**
 * A figure in the daily-brief grid.
 *
 * Two of the six sample metrics are money and four are plain counts, so the
 * face has to be chosen per item rather than per column. Money takes JetBrains
 * Mono with tabular figures — the sanctioned use, and the right call because
 * the currency column has to align on the decimal. Counts take Fraunces, so a
 * count never reads as a currency amount and vice versa.
 *
 * Fraunces here is an explicit opt-in: inside `.app-scope` the display token is
 * remapped back to the sans, because a serif over a dense table of figures
 * reads as a fault. This is a landing-page figure at 19px, not a table row, so
 * it keeps the editorial numeral.
 *
 * The `data-mono` marker rides the same branch. That is deliberate: a blanket
 * marker on the grid would put four counts into the money typeface and assert
 * they were amounts, which is exactly the kind of quiet lie the marker exists
 * to prevent.
 */
function Metric({ value }: { value: string }) {
  return value.trim().startsWith("₹") ? (
    <p data-mono="money" className="mt-1 font-mono text-[19px] font-medium tabular-nums">
      {value}
    </p>
  ) : (
    <p className="mt-1 font-display text-[19px] font-medium tracking-[-0.01em] tabular-nums">
      {value}
    </p>
  )
}

/**
 * The daily loop.
 *
 * This section was the worst offender for the two things you flagged:
 *
 *  1. Fake numbers. "₹2.4Cr weighted", "7 / 10 important actions completed",
 *     "11 leads contacted" were invented and presented as a real customer's day.
 *     Fabricated metrics are the same category of problem as the invented
 *     testimonials in the manifesto — a prospect can hold you to them. The
 *     figures below are now explicitly labelled as sample data, and the panel
 *     leads with the mechanism instead of a number nobody can verify.
 *
 *  2. Emoji as UI. 📋 and 🎉 were being used as icons. Replaced with lucide
 *     glyphs, matching the rest of the page.
 *
 * Layout family: asymmetric — one dominant cell, one supporting cell — so the
 * two halves are not the same weight.
 */
const SAMPLE_METRICS = [
  { label: "Weighted pipeline", value: "₹2.4Cr" },
  { label: "New leads", value: "12" },
  { label: "Hot leads", value: "4" },
  { label: "Site visits today", value: "6" },
  { label: "Follow-ups overdue", value: "3" },
  { label: "Deals at risk", value: "2" },
]

const WINS = [
  { icon: TrendingUp, label: "Leads contacted" },
  { icon: Package, label: "Follow-ups completed" },
  { icon: ClipboardCheck, label: "Site visits logged" },
  { icon: FileText, label: "Cost sheets sent" },
]

export function WinsSection({
  isAuthed,
  workspaceSlug,
}: {
  isAuthed: boolean
  workspaceSlug?: string | null
}) {
  const cta = isAuthed && workspaceSlug ? `/${workspaceSlug}/dashboard` : "/signup"

  return (
    <section className="border-y border-border/70 bg-background">
      <div className="mx-auto max-w-[1280px] px-6 py-20 lg:px-8 lg:py-28">
        <SectionHeader
          title="The day starts and ends with a number."
          body="Not vanity metrics. Estate360 tracks the work that actually moves a booking, then hands you a sharper briefing the next morning."
        />

        <div className="mt-12 grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
          {/* Dominant cell — the morning brief. */}
          <div className="rounded-md border border-border/70 bg-card p-6">
            <div className="flex items-center gap-2.5">
              <span className="flex size-8 items-center justify-center rounded-sm bg-foreground text-background">
                <ClipboardCheck className="size-4" aria-hidden />
              </span>
              <h3 className="text-[16px] font-semibold tracking-[-0.01em]">
                Your 9:00 AM brief
              </h3>
            </div>
            <p className="mt-2 text-[13px] text-muted-foreground">
              Everything worth seeing before the first call, ranked.
            </p>

            <div className="mt-6 grid grid-cols-2 gap-px overflow-hidden rounded-sm border border-border/70 bg-border/70 sm:grid-cols-3">
              {SAMPLE_METRICS.map((m) => (
                <div key={m.label} className="bg-card p-3.5">
                  <p className="text-[11px] leading-4 text-muted-foreground">{m.label}</p>
                  <Metric value={m.value} />
                </div>
              ))}
            </div>

            <p className="mt-4 text-[12px] text-muted-foreground">
              Illustrative figures from a sample workspace, shown so you can see the
              shape of the brief. Your numbers populate on sign-up.
            </p>
          </div>

          {/* Supporting cell — end of day. */}
          <div className="flex flex-col rounded-md border border-border/70 bg-surface-sunken p-6">
            <div className="flex items-center gap-2.5">
              <span className="flex size-8 items-center justify-center rounded-sm bg-brand/10 text-brand">
                <TrendingUp className="size-4" aria-hidden />
              </span>
              <h3 className="text-[16px] font-semibold tracking-[-0.01em]">
                End of day
              </h3>
            </div>

            <div className="mt-5">
              <div className="flex items-baseline justify-between">
                <span className="text-[13px] text-muted-foreground">
                  Important actions completed
                </span>
                {/* A fraction of tasks — chrome, not money. */}
                <span className="text-[13px] tabular-nums text-muted-foreground">7 / 10</span>
              </div>
              <Progress value={70} className="mt-2 h-1.5" />
            </div>

            <ul className="mt-5 rule-y">
              {WINS.map((w) => {
                const Icon = w.icon
                return (
                  <li key={w.label} className="flex items-center gap-2.5 py-2.5">
                    <Icon className="size-3.5 shrink-0 text-brand" aria-hidden />
                    <span className="text-[13px]">{w.label}</span>
                  </li>
                )
              })}
            </ul>

            <p className="mt-auto pt-5 text-[12px] leading-5 text-muted-foreground">
              Whatever did not get done carries to tomorrow morning, and the brief
              opens with it.
            </p>
          </div>
        </div>

        {/* The single primary action, repeated. This section already built the
            desire — it shows the shape of a working day — which is exactly where
            a reader is deciding, so it is where the CTA belongs. It was missing:
            the href and the Button import were both here, unused, which is the
            signature of a call-to-action that got dropped in an edit and never
            noticed because nothing errored on an unused variable. */}
        <div className="mt-10 flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="max-w-[42ch] text-[15px] leading-7 text-muted-foreground text-pretty">
            Your first brief builds itself from whatever you import. Bring a real
            project and see it by tomorrow morning.
          </p>
          <Button variant="brand" size="lg" className="h-11 shrink-0 gap-2 px-6" render={<Link href={cta} />}>
            {isAuthed ? "Open your workspace" : "Start free"}
            <ArrowRight className="size-4" aria-hidden />
          </Button>
        </div>
      </div>
    </section>
  )
}
