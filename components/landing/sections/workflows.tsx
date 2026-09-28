import type { ComponentType } from "react"
import { SectionHeader } from "@/components/landing/section-header"
import { cn } from "@/lib/utils"
import {
  Zap,
  ThermometerSun,
  MapPin,
  TrendingUp,
  Clock,
  FileText,
  MessageSquare,
} from "lucide-react"

/**
 * The work Estate360 removes.
 *
 * This was eight identical white cards in a uniform 4-column grid — the textbook
 * "feature grid" tell. Three fixes:
 *  1. Cut from 8 items to 6. Eight cards is a data dump; six is a page. The two
 *     dropped (GPS verification, offline visits) are field-engineer features
 *     that belong on /product, not in a pre-signup pitch.
 *  2. Real bento rhythm — one 4-col feature, four 2-col cells, one full-width
 *     closer. No cell is a blank filler and the count matches the content.
 *     The 2-col span on `Cell` is load-bearing: without it every feature cell
 *     collapsed to 1 of 6 columns (189px), so row two used 2 of 6 and left an
 *     822px hole on the right. Four 2-col cells + the 4-col feature = 6 per
 *     row exactly, with no gap at any breakpoint.
 *  3. Two cells carry actual visual content (a ranked queue, a cost-sheet
 *     strip) and one carries a bronze gradient ground, so the grid is not six
 *     white rectangles with type inside.
 *
 * Per the brand's language rule: observable outcomes and verbs, never "AI-powered".
 */
type Workflow = {
  icon: ComponentType<{ className?: string }>
  title: string
  detail: string
}

const QUEUE = [
  { name: "Rahul Shah", why: "cost sheet opened 3×", tone: "critical" },
  { name: "Priya Mehta", why: "site visit tomorrow", tone: "caution" },
  { name: "Amit Patel", why: "asked about EMI", tone: "info" },
] as const

const COST_SHEET = [
  { label: "Base price", value: "₹68,00,000" },
  { label: "GST (5%)", value: "₹3,40,000" },
  { label: "Stamp duty", value: "₹6,80,000" },
  { label: "Other charges", value: "₹3,80,000" },
]

export function WorkflowsSection() {
  return (
    <section id="product" className="mx-auto max-w-[1280px] px-6 py-20 lg:px-8 lg:py-28">
      <SectionHeader
        title="Six things your team stops doing by hand."
        body="Each one replaces a step that currently lives in a WhatsApp thread, a spreadsheet, or somebody's memory."
      />

      <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-6">
        {/* ── Feature cell: the ranked queue, on a bronze gradient ground ── */}
        <div className="relative overflow-hidden rounded-md border border-border/70 p-6 sm:col-span-2 lg:col-span-4">
          <div
            aria-hidden
            className="absolute inset-0 -z-10 bg-gradient-to-br from-brand/[0.09] via-brand/[0.03] to-transparent"
          />
          <div className="flex items-center gap-2.5">
            <span className="flex size-8 items-center justify-center rounded-sm bg-brand text-brand-foreground">
              <Zap className="size-4" aria-hidden />
            </span>
            <h3 className="text-[16px] font-semibold tracking-[-0.01em]">
              Know which lead needs a call next
            </h3>
          </div>
          <p className="mt-3 max-w-[46ch] text-[14px] leading-6 text-muted-foreground">
            Every record carries a Next Best Action built from site visits,
            cost-sheet opens and time since last contact.
          </p>

          <ul className="mt-5 rule-y">
            {QUEUE.map((row, i) => (
              <li key={row.name} className="flex items-center gap-3 py-2.5">
                {/* Step ordinal — a label, not a figure. Sans; the mono token is reserved for money. */}
                <span className="w-4 shrink-0 text-[11px] tabular-nums text-muted-foreground">
                  {i + 1}
                </span>
                <span className="min-w-0 flex-1 truncate text-[14px] font-medium">
                  {row.name}
                </span>
                <span
                  className={cn(
                    "shrink-0 rounded-sm px-2 py-0.5 text-[11px]",
                    row.tone === "critical" && "bg-status-critical-bg text-status-critical-fg",
                    row.tone === "caution" && "bg-status-caution-bg text-status-caution-fg",
                    row.tone === "info" && "bg-status-info-bg text-status-info-fg"
                  )}
                >
                  {row.why}
                </span>
              </li>
            ))}
          </ul>
        </div>

        <Cell
          icon={ThermometerSun}
          title="Leads tell you their temperature"
          detail="Hot, warm, nurture or cold, each with the reason attached."
        />

        <Cell
          icon={MapPin}
          title="The right unit in seconds"
          detail="Describe the need in plain English, get ranked units with cost sheets filled in."
        />

        <Cell
          icon={TrendingUp}
          title="Deals that will not wait"
          detail="Stalled bookings and overdue milestones surface before anyone notices."
        />

        <Cell
          icon={Clock}
          title="Follow-ups that do not get lost"
          detail="Forgotten leads, missed calls and late tasks land in today, upcoming, overdue."
        />

        {/* ── Full-width closer: a real cost-sheet breakdown, not a claim ── */}
        <div className="rounded-md border border-border/70 bg-surface-sunken p-6 sm:col-span-2 lg:col-span-6">
          <div className="grid gap-8 lg:grid-cols-[1fr_1.1fr] lg:items-center">
            <div>
              <span className="flex size-8 items-center justify-center rounded-sm bg-foreground text-background">
                <FileText className="size-4" aria-hidden />
              </span>
              <h3 className="mt-3 text-[16px] font-semibold tracking-[-0.01em]">
                A cost sheet in under thirty seconds
              </h3>
              <p className="mt-2 max-w-[46ch] text-[14px] leading-6 text-muted-foreground">
                Base, GST, stamp duty and other charges, totalled from the unit
                record. Preview the PDF, send it on WhatsApp, or download it.
                Draft replies go out in the buyer&apos;s own language, with UPI
                links attached.
              </p>
              <p className="mt-3 flex items-center gap-1.5 text-[12px] text-muted-foreground">
                <MessageSquare className="size-3.5" aria-hidden />
                You review every message before it sends. Nothing moves money automatically.
              </p>
            </div>

            <dl className="rounded-md border border-border/70 bg-card">
              {COST_SHEET.map((row) => (
                <div
                  key={row.label}
                  className="flex items-center justify-between gap-4 border-b border-border/60 px-4 py-2.5 last:border-b-0"
                >
                  <dt className="text-[13px] text-muted-foreground">{row.label}</dt>
                  {/* Money — mono is the sanctioned use, and tabular alignment
                      is load-bearing in a right-aligned cost breakdown. */}
                  <dd data-mono="money" className="font-mono text-[13px] tabular-nums">
                    {row.value}
                  </dd>
                </div>
              ))}
              <div className="flex items-center justify-between gap-4 border-t border-border bg-brand-soft px-4 py-3">
                <dt className="text-[13px] font-semibold">Total</dt>
                <dd data-mono="money" className="font-mono text-[15px] font-semibold tabular-nums">
                  ₹82,00,000
                </dd>
              </div>
            </dl>
          </div>
        </div>
      </div>
    </section>
  )
}

function Cell({ icon: Icon, title, detail }: Workflow) {
  return (
    <div className="group rounded-md border border-border/70 bg-card p-5 transition-colors duration-200 hover:border-border sm:col-span-2">
      <span className="flex size-8 items-center justify-center rounded-sm bg-muted text-foreground transition-colors duration-200 group-hover:bg-brand group-hover:text-brand-foreground">
        <Icon className="size-4" aria-hidden />
      </span>
      <h3 className="mt-3 text-[15px] font-semibold leading-snug tracking-[-0.01em]">
        {title}
      </h3>
      <p className="mt-1.5 text-[13px] leading-6 text-muted-foreground">{detail}</p>
    </div>
  )
}
