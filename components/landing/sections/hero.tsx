"use client"

import Link from "next/link"
import { Button } from "@/components/ui/button"
import {
  ArrowRight,
  CalendarClock,
  Check,
  CheckCheck,
  FileCheck2,
  FileText,
  Flame,
  Languages,
  MapPinCheck,
  MessageCircle,
  TriangleAlert,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { GTM_EVENTS, trackEvent } from "@/lib/analytics"

/**
 * Hero.
 *
 * Studied against Sell.Do, Follow Up Boss, Lofty and LeadSquared. They share a
 * structure that works (a centred claim, trial plus demo, proof, then a big
 * product visual) and a habit that does not: the claim is "AI" and scale, and
 * the visual is a generic dashboard any CRM could ship.
 *
 * This keeps the structure and swaps the substance:
 *  - The claim is scope, not technology: enquiry to possession. No other
 *    category of CRM ends at possession, so the headline sorts the visitor.
 *  - The proof row states shipped capabilities. There are no customer logos
 *    yet, and inventing them is not an option (see manifesto.tsx).
 *  - The visual is a composed stage of three things only a builder's CRM has:
 *    the ranked call queue, a tower's unit board, and a Gujarati WhatsApp
 *    thread carrying a cost sheet. One panel carries the page's single
 *    signature effect (`.beam-border`); the other two are still.
 *
 * Everything on the stage is static illustration, so the fake buttons inside it
 * are `tabIndex={-1}` and the stage is `aria-hidden` with a text summary.
 */
const PROOF = [
  { icon: FileCheck2, label: "RERA demand notices" },
  { icon: MessageCircle, label: "WhatsApp with UPI links" },
  { icon: MapPinCheck, label: "GPS-verified site visits" },
  { icon: Languages, label: "English, ગુજરાતી, हिन्दी" },
]

type UnitStatus = "available" | "hold" | "booked" | "sold"

const TOWER: { floor: number; units: { no: string; s: UnitStatus }[] }[] = [
  { floor: 14, units: [{ no: "A-1401", s: "available" }, { no: "A-1402", s: "available" }, { no: "A-1403", s: "hold" }, { no: "A-1404", s: "available" }] },
  { floor: 13, units: [{ no: "A-1301", s: "booked" }, { no: "A-1302", s: "available" }, { no: "A-1303", s: "available" }, { no: "A-1304", s: "booked" }] },
  { floor: 12, units: [{ no: "A-1201", s: "sold" }, { no: "A-1202", s: "booked" }, { no: "A-1203", s: "hold" }, { no: "A-1204", s: "available" }] },
  { floor: 11, units: [{ no: "A-1101", s: "sold" }, { no: "A-1102", s: "sold" }, { no: "A-1103", s: "booked" }, { no: "A-1104", s: "sold" }] },
]

const UNIT_CELL: Record<UnitStatus, string> = {
  available: "bg-status-positive-bg text-status-positive-fg border-status-positive-fg/25",
  hold: "bg-status-caution-bg text-status-caution-fg border-status-caution-fg/25",
  booked: "bg-status-info-bg text-status-info-fg border-status-info-fg/25",
  sold: "bg-surface-sunken text-muted-foreground border-hairline",
}

const counts = TOWER.flatMap((f) => f.units).reduce<Record<UnitStatus, number>>(
  (acc, u) => ({ ...acc, [u.s]: acc[u.s] + 1 }),
  { available: 0, hold: 0, booked: 0, sold: 0 }
)

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
      <div aria-hidden className="field-gradient -z-10" />

      <div className="mx-auto max-w-[1280px] px-6 lg:px-8">
        {/* ── The claim ── */}
        <div className="mx-auto max-w-[860px] pt-16 text-center lg:pt-24">
          <p
            className="animate-rise-in text-[11px] font-semibold uppercase tracking-[0.16em] text-brand-solid"
            style={{ animationDelay: "0ms" }}
          >
            CRM for real-estate builders<span className="hidden sm:inline"> · Made in Ahmedabad</span>
          </p>

          <h1
            className="animate-rise-in mt-5 font-display text-[42px] font-semibold leading-[1.02] tracking-[-0.035em] text-balance sm:text-[56px] lg:text-[68px]"
            style={{ animationDelay: "70ms" }}
          >
            From first enquiry
            <br className="hidden sm:block" />{" "}
            <span className="text-muted-foreground">to possession, on one screen.</span>
          </h1>

          <p
            className="animate-rise-in mx-auto mt-6 max-w-[58ch] text-[17px] leading-8 text-balance text-muted-foreground"
            style={{ animationDelay: "140ms" }}
          >
            Leads, WhatsApp, site visits, unit holds, cost sheets and CLP
            collections in one place. Open it at 9 AM and it tells your team who
            to call first.
          </p>

          <div
            className="animate-rise-in mt-9 flex flex-wrap items-center justify-center gap-3"
            style={{ animationDelay: "210ms" }}
          >
            <Button
              variant="brand"
              size="lg"
              className="h-12 gap-2 px-6 text-[15px]"
              render={
                <Link
                  href={primaryHref}
                  onClick={() =>
                    !isAuthed && trackEvent(GTM_EVENTS.heroStartFree, { location: "hero" })
                  }
                />
              }
            >
              {isAuthed ? "Open your workspace" : "Start your 14-day trial"}
              <ArrowRight className="size-4" aria-hidden />
            </Button>
            <Button
              variant="outline"
              size="lg"
              className="h-12 gap-2 bg-card px-6 text-[15px]"
              render={<Link href="/demo" />}
            >
              Book a 20-minute demo
            </Button>
          </div>

          {!isAuthed ? (
            <p
              className="animate-rise-in mt-4 text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground"
              style={{ animationDelay: "280ms" }}
            >
              No card · Real workspace, not a demo · Export anytime
            </p>
          ) : null}
        </div>

        {/* ── Proof: shipped capabilities, in place of logos we do not have ── */}
        <ul
          className="animate-rise-in mx-auto mt-10 flex max-w-[920px] flex-wrap items-center justify-center gap-x-7 gap-y-3"
          style={{ animationDelay: "320ms" }}
        >
          {PROOF.map(({ icon: Icon, label }) => (
            <li key={label} className="flex items-center gap-2 text-[13px] text-muted-foreground">
              <Icon className="size-4 shrink-0 text-brand" aria-hidden />
              {label}
            </li>
          ))}
        </ul>

        {/* ── The stage ── */}
        <p className="sr-only">
          Product preview: a ranked list of who to call next, a tower inventory
          board showing available, held, booked and sold units, and a WhatsApp
          conversation in Gujarati with a cost sheet attached.
        </p>
        <div
          aria-hidden
          className="animate-rise-in relative mt-14 pb-16 lg:mt-16 lg:pb-24"
          style={{ animationDelay: "380ms" }}
        >
          <div className="grid items-start gap-4 md:grid-cols-[1fr_1.1fr] lg:grid-cols-[1.05fr_1fr_0.95fr]">
            {/* 1 · Who to call — the signature panel */}
            <div className="beam-border rounded-md border border-border/70 bg-card p-5 lg:mt-10">
              <div className="flex items-baseline justify-between gap-4">
                <p className="label-caps">Next best action</p>
                <p className="text-[11px] tabular-nums text-muted-foreground">9:02 AM</p>
              </div>

              <div className="mt-4 rounded-sm border border-border/70 bg-surface-sunken p-4">
                <div className="flex items-start gap-3">
                  <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-sm bg-brand text-brand-foreground">
                    <Flame className="size-4" />
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
                  <Button size="sm" className="h-8 px-3 text-[13px]" tabIndex={-1}>
                    Call now
                  </Button>
                  <Button size="sm" variant="outline" className="h-8 px-3 text-[13px]" tabIndex={-1}>
                    WhatsApp
                  </Button>
                </div>
              </div>

              <ul className="mt-2 rule-y">
                <li className="flex items-center gap-3 py-3">
                  <CalendarClock className="size-4 shrink-0 text-muted-foreground" />
                  <p className="min-w-0 flex-1 truncate text-[13px]">Priya Mehta, site visit tomorrow</p>
                  <span className="shrink-0 text-[12px] text-muted-foreground">Send cost sheet</span>
                </li>
                <li className="flex items-center gap-3 py-3">
                  <TriangleAlert className="size-4 shrink-0 text-status-critical-fg" />
                  <p className="min-w-0 flex-1 truncate text-[13px]">A-1203 hold expires in 2h</p>
                  <span className="shrink-0 text-[12px] text-muted-foreground">Extend or release</span>
                </li>
              </ul>
            </div>

            {/* 2 · The tower — what a builder actually sells */}
            <div className="rounded-md border border-border/70 bg-card p-5">
              <div className="flex items-baseline justify-between gap-4">
                <div>
                  <p className="text-[14px] font-semibold tracking-[-0.01em]">Shanti Heights · Tower A</p>
                  <p className="mt-0.5 text-[12px] text-muted-foreground">SG Highway, Ahmedabad</p>
                </div>
                <p className="label-caps">Live</p>
              </div>

              <div className="mt-5 space-y-1.5">
                {TOWER.map((row) => (
                  <div key={row.floor} className="flex items-center gap-2.5">
                    <span className="w-5 shrink-0 text-right text-[11px] tabular-nums text-muted-foreground">
                      {row.floor}
                    </span>
                    <div className="grid flex-1 grid-cols-4 gap-1.5">
                      {row.units.map((u) => (
                        <span
                          key={u.no}
                          className={cn(
                            "rounded-sm border px-1.5 py-1.5 text-center",
                            UNIT_CELL[u.s],
                            u.no === "A-1204" && "ring-1 ring-foreground"
                          )}
                        >
                          <span data-mono="id" className="font-mono text-[11px] tabular-nums">
                            {u.no.slice(2)}
                          </span>
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              <dl className="mt-5 grid grid-cols-4 gap-2 border-t border-hairline pt-4">
                {(
                  [
                    ["available", "Open"],
                    ["hold", "Held"],
                    ["booked", "Booked"],
                    ["sold", "Sold"],
                  ] as const
                ).map(([key, label]) => (
                  <div key={key}>
                    <dt className="text-[11px] text-muted-foreground">{label}</dt>
                    <dd className="mt-0.5 font-display text-[20px] font-medium leading-none tabular-nums">
                      {counts[key]}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>

            {/* 3 · The conversation — the buyer's language, the real number */}
            <div className="hidden rounded-md border border-border/70 bg-card p-5 md:col-span-2 md:block lg:col-span-1 lg:mt-16">
              <div className="flex items-center gap-3 border-b border-hairline pb-3">
                <span className="flex size-8 items-center justify-center rounded-full bg-muted text-[12px] font-semibold">
                  RS
                </span>
                <div className="min-w-0">
                  <p className="text-[13px] font-semibold">Rahul Shah</p>
                  <p className="text-[11px] text-muted-foreground">WhatsApp · ગુજરાતી</p>
                </div>
              </div>

              <div className="mt-4 space-y-2.5">
                <p className="max-w-[85%] rounded-md rounded-tl-sm bg-surface-sunken px-3 py-2 text-[13px] leading-5">
                  A-1204 no final rate su che? Parking sathe?
                </p>
                <div className="ml-auto max-w-[88%] rounded-md rounded-tr-sm bg-status-positive-bg px-3 py-2 text-[13px] leading-5 text-foreground">
                  નમસ્તે રાહુલભાઈ, A-1204 ની કોસ્ટ શીટ અહીં છે. પાર્કિંગ સામેલ છે.
                  <div className="mt-2 flex items-center gap-2.5 rounded-sm border border-border/70 bg-card px-2.5 py-2">
                    <FileText className="size-4 shrink-0 text-muted-foreground" />
                    <span className="min-w-0 flex-1 truncate text-[12px] font-medium">Cost sheet · A-1204.pdf</span>
                    <span data-mono="money" className="shrink-0 font-mono text-[12px] tabular-nums">
                      ₹82,00,000
                    </span>
                  </div>
                  <p className="mt-1 flex items-center justify-end gap-1 text-[10px] text-muted-foreground">
                    10:14 <CheckCheck className="size-3" />
                  </p>
                </div>
              </div>

              <p className="mt-4 flex items-center gap-1.5 border-t border-hairline pt-3 text-[11px] text-muted-foreground">
                <Check className="size-3.5 text-status-positive-fg" />
                Logged on the deal. Follow-up set for tomorrow.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
