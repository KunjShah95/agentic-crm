"use client"

import { useState } from "react"
import { cn } from "@/lib/utils"
import { SectionHeader } from "@/components/landing/section-header"
import { Compass, Ruler, Timer } from "lucide-react"

/**
 * The unit record.
 *
 * Every other section on this page argues from workflow — leads, WhatsApp, site
 * visits, cost sheets. None of them show the thing a builder actually sells,
 * which is a stack of units, and none of them confront the three questions that
 * decide whether a sale closes in this market:
 *
 *   carpet or built-up   the advertised figure and the figure the buyer gets
 *   which way it faces   decides resale, and it is the second thing asked
 *   is it still held     a lapsed hold is revenue that looks like revenue
 *
 * A generic CRM feature grid cannot make those arguments because it does not
 * know they exist. Every field below is in the Prisma `Unit` model and the
 * `Project.reraNo` — carpetArea, facing, holdUntil, config, status — so this is
 * a picture of the actual record rather than an illustration of one.
 *
 * Interaction: hovering or focusing a unit in the stack swaps the record panel
 * to that unit. That is the one purposeful motion moment on the page — it is a
 * trigger→feedback pair that *explains* the stack, rather than motion applied to
 * make a surface look alive. It is on buttons rather than divs so it works from
 * the keyboard, which is the whole reason a hover-driven panel is normally a
 * mistake.
 *
 * The hold countdown is deliberately static text. See `timeUntil`.
 */

type Unit = {
  unitNo: string
  floor: number
  config: string
  carpet: number
  builtUp: number
  facing: string
  price: string
  status: "AVAILABLE" | "HOLD" | "BOOKED" | "SOLD"
  hold?: string
}

const FLOORS: { floor: number; units: Unit[] }[] = [
  {
    floor: 12,
    units: [
      {
        unitNo: "A-1204",
        floor: 12,
        config: "3BHK",
        carpet: 1180,
        builtUp: 1410,
        facing: "East",
        price: "₹82,00,000",
        status: "AVAILABLE",
      },
      {
        unitNo: "A-1205",
        floor: 12,
        config: "3BHK",
        carpet: 1180,
        builtUp: 1410,
        facing: "West",
        price: "₹79,50,000",
        status: "HOLD",
        hold: "in 2h 10m",
      },
    ],
  },
  {
    floor: 11,
    units: [
      {
        unitNo: "A-1103",
        floor: 11,
        config: "2BHK",
        carpet: 890,
        builtUp: 1065,
        facing: "North",
        price: "₹61,00,000",
        status: "BOOKED",
      },
      {
        unitNo: "A-1104",
        floor: 11,
        config: "2BHK",
        carpet: 890,
        builtUp: 1065,
        facing: "East",
        price: "₹63,25,000",
        status: "SOLD",
      },
    ],
  },
  {
    floor: 10,
    units: [
      {
        unitNo: "A-1002",
        floor: 10,
        config: "1BHK",
        carpet: 545,
        builtUp: 650,
        facing: "South",
        price: "₹38,75,000",
        status: "SOLD",
      },
      {
        unitNo: "A-1003",
        floor: 10,
        config: "SHOP",
        carpet: 310,
        builtUp: 380,
        facing: "West",
        price: "₹54,00,000",
        status: "SOLD",
      },
    ],
  },
]

const ALL_UNITS = FLOORS.flatMap((f) => f.units)

/* Status is carried by fill on the cell, not by a coloured dot beside a label —
   the stack is meant to be read as a distribution at a glance, the way a
   physical board of keys is, and a legend forces that back into reading. */
const STATUS_CELL: Record<Unit["status"], string> = {
  AVAILABLE: "bg-status-positive-bg text-status-positive-fg border-status-positive-fg/25",
  HOLD: "bg-status-caution-bg text-status-caution-fg border-status-caution-fg/25",
  BOOKED: "bg-status-info-bg text-status-info-fg border-status-info-fg/25",
  SOLD: "bg-surface-sunken text-muted-foreground border-hairline",
}

const STATUS_LABEL: Record<Unit["status"], string> = {
  AVAILABLE: "Available",
  HOLD: "On hold",
  BOOKED: "Booked",
  SOLD: "Sold",
}

export function InventorySection() {
  const [activeId, setActiveId] = useState(ALL_UNITS[0].unitNo)
  const unit = ALL_UNITS.find((u) => u.unitNo === activeId) ?? ALL_UNITS[0]

  return (
    <section id="inventory" className="border-t border-border/70 bg-background">
      <div className="mx-auto max-w-[1280px] px-6 py-20 lg:px-8 lg:py-28">
        <SectionHeader
          eyebrow="Inventory"
          title="Carpet or built-up. East or west. Held or gone."
          body="Three questions decide whether a sale closes, and all three are fields on the record rather than a note somebody remembered. Estate360 stores them once, so the sales floor, the cost sheet and the buyer portal cannot disagree about what is being sold."
        />

        <div className="mt-12 overflow-hidden rounded-md border border-border/70 bg-surface-sunken">
          {/* Project strip. `reraNo` is the identifier a builder is legally
              registered under, so it belongs on the record the way a company
              number belongs on an invoice. */}
          <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 border-b border-border/70 bg-card px-5 py-3.5">
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <span className="text-[14px] font-semibold tracking-[-0.01em]">
                Shanti Heights
              </span>
              <span className="text-[12px] text-muted-foreground">
                SG Highway, Ahmedabad
              </span>
            </div>
            <span className="flex items-baseline gap-2">
              <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                ERA
              </span>
              {/* An identifier, so the mono face — the sanctioned use. */}
              <span data-mono="id" className="font-mono text-[12px] tabular-nums">
                P05200047112
              </span>
            </span>
          </div>

          <div className="grid gap-px bg-border/70 lg:grid-cols-[0.85fr_1.15fr]">
            {/* ── The record for whichever unit is active ── */}
            <div className="bg-card p-5 sm:p-6">
              {/* Keyed on the unit so the panel genuinely re-enters rather than
                  just having its text swapped. `animate-rise-in` is the same
                  one-shot the app uses on page enter; it is not a loop and it
                  does not run on first paint. */}
              <div key={unit.unitNo} className="animate-rise-in">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    {/* Unit number is an identifier, so mono. */}
                    <p data-mono="id" className="font-mono text-[19px] font-medium tabular-nums tracking-[-0.01em]">
                      {unit.unitNo}
                    </p>
                    <p className="mt-0.5 text-[12px] text-muted-foreground">
                      Tower A · {unit.floor}
                      {ordinal(unit.floor)} floor
                    </p>
                  </div>
                  <span
                    className={cn(
                      "shrink-0 rounded-sm border px-2 py-0.5 text-[11px] font-medium",
                      STATUS_CELL[unit.status]
                    )}
                  >
                    {STATUS_LABEL[unit.status]}
                  </span>
                </div>

                <div className="mt-5 flex items-baseline justify-between gap-4 border-b border-hairline pb-4">
                  <span className="text-[13px] text-muted-foreground">
                    {unit.config}
                  </span>
                  {/* Money — mono, tabular, the other sanctioned use. */}
                  <span data-mono="money" className="font-mono text-[17px] font-medium tabular-nums">
                    {unit.price}
                  </span>
                </div>

                {/* Carpet vs built-up, side by side. This pairing is the single
                    most misrepresented number in Indian residential sales, so it
                    is shown as a pair rather than as one "area" field. */}
                <div className="mt-4 grid grid-cols-2 gap-4">
                  <div>
                    <p className="label-caps">Carpet</p>
                    <p className="mt-1 text-[15px] tabular-nums">
                      {unit.carpet.toLocaleString("en-IN")}{" "}
                      <span className="text-[12px] text-muted-foreground">sq.ft</span>
                    </p>
                  </div>
                  <div>
                    <p className="label-caps">Built-up</p>
                    <p className="mt-1 text-[15px] tabular-nums">
                      {unit.builtUp.toLocaleString("en-IN")}{" "}
                      <span className="text-[12px] text-muted-foreground">sq.ft</span>
                    </p>
                  </div>
                </div>

                <div className="mt-4 flex items-center justify-between gap-4 text-[13px]">
                  <span className="flex items-center gap-2 text-muted-foreground">
                    <Compass className="size-3.5" aria-hidden />
                    Facing
                  </span>
                  <span>{unit.facing}</span>
                </div>

                {unit.hold ? (
                  <div className="mt-3 flex items-center justify-between gap-4 rounded-sm border border-status-caution-fg/25 bg-status-caution-bg px-3 py-2 text-[13px]">
                    <span className="flex items-center gap-2 text-status-caution-fg">
                      <Timer className="size-3.5" aria-hidden />
                      Hold expires
                    </span>
                    <span className="font-medium tabular-nums text-status-caution-fg">
                      {unit.hold}
                    </span>
                  </div>
                ) : null}
              </div>
            </div>

            {/* ── The stack ── */}
            <div className="bg-card p-5 sm:p-6">
              <div className="flex items-center justify-between gap-4">
                <p className="label-caps">Tower A · upper floors</p>
                <p className="text-[11px] text-muted-foreground">
                  Hover or focus a unit
                </p>
              </div>

              <div className="mt-4 space-y-2">
                {FLOORS.map((row) => (
                  <div key={row.floor} className="flex items-center gap-3">
                    <span className="w-7 shrink-0 text-right text-[11px] tabular-nums text-muted-foreground">
                      {row.floor}
                    </span>
                    <div className="flex flex-1 gap-2">
                      {row.units.map((u) => {
                        const active = u.unitNo === unit.unitNo
                        return (
                          <button
                            key={u.unitNo}
                            type="button"
                            onMouseEnter={() => setActiveId(u.unitNo)}
                            onFocus={() => setActiveId(u.unitNo)}
                            onClick={() => setActiveId(u.unitNo)}
                            aria-pressed={active}
                            className={cn(
                              // Colour is the status; the ring is the selection.
                              // Keeping those two channels separate is what stops
                              // the active unit looking like a fifth status.
                              "pressable flex-1 rounded-sm border px-2.5 py-2 text-left transition-[border-color,box-shadow]",
                              STATUS_CELL[u.status],
                              active && "border-foreground ring-1 ring-foreground"
                            )}
                          >
                            <span data-mono="id" className="block font-mono text-[12px] tabular-nums">
                              {u.unitNo}
                            </span>
                            {/* 11px, not 10. This is the only label inside a
                                tap target on the page, so it is the one place a
                                sub-11px label is actually being read as the thing
                                you are about to press rather than as metadata. */}
                            <span className="mt-0.5 block text-[11px] opacity-80">
                              {u.config}
                            </span>
                          </button>
                        )
                      })}
                    </div>
                  </div>
                ))}
              </div>

              <p className="mt-5 border-t border-hairline pt-4 text-[12px] leading-5 text-muted-foreground">
                Six units of a forty-four unit tower. The board view filters to a
                floor, a facing or a status band; the same record drives the cost
                sheet, the allotment letter and the public site.
              </p>
            </div>
          </div>
        </div>

        {/* The three arguments, as claims rather than as feature bullets. */}
        <div className="mt-8 grid gap-6 sm:grid-cols-3">
          {[
            {
              icon: Ruler,
              title: "Carpet and built-up, both stored",
              detail:
                "The cost sheet prints one and the buyer portal prints the other, from the same row. Nobody retypes a number, so the two can no longer drift.",
            },
            {
              icon: Compass,
              title: "Facing is a filter, not a note",
              detail:
                'Buyers ask for east before they ask for price. "East, 10th and above, under ₹80L" is a saved search, not a WhatsApp thread.',
            },
            {
              icon: Timer,
              title: "A hold that says when it ends",
              detail:
                "Hold expiry is on the record with a timestamp, so an expired hold surfaces on the morning brief instead of being discovered at handover.",
            },
          ].map((item) => {
            const Icon = item.icon
            return (
              <div key={item.title}>
                <span className="flex size-8 items-center justify-center rounded-sm bg-brand/10 text-brand">
                  <Icon className="size-4" aria-hidden />
                </span>
                <h3 className="mt-3 text-[14px] font-semibold tracking-[-0.01em]">
                  {item.title}
                </h3>
                <p className="mt-1.5 text-[13px] leading-6 text-muted-foreground">
                  {item.detail}
                </p>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}

function ordinal(n: number) {
  const s = ["th", "st", "nd", "rd"]
  const v = n % 100
  return s[(v - 20) % 10] || s[v] || s[0]
}
