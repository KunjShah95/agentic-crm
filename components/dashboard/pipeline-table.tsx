import * as React from "react"
import Link from "next/link"
import { ArrowUpRight } from "lucide-react"

import { formatMoneyShort, initials, relativeTime } from "@/lib/format"
import { cn } from "@/lib/utils"
import { Panel, PanelFooter, PanelHeader, FooterMetric } from "@/components/ds/panel"
import { EmptyState } from "@/components/ds/empty"

export type DealRow = {
  id: string
  title: string
  value: number | null
  currency: string
  probability: number | null
  stage: { name: string; color: string }
  owner: { name: string } | null
  organization: { name: string } | null
  contact: { firstName: string; lastName: string } | null
}

/**
 * The pipeline table.
 *
 * Hand-built rather than composed from `components/ui/table`, because three
 * stock table defaults are actively wrong for this design:
 *
 *  - **`hover:bg-muted` on the header row** tints the header, which on a
 *    black-and-white canvas is the loudest thing on the panel. Here the header
 *    is a hairline and 10px caps, sitting *below* the data in visual weight.
 *  - **A 12px "win probability" cell with a coloured fill bar** — the old
 *    `WinBar` used the brand amber as a probability fill, which put the only
 *    colour in the app inside a table cell. Probability here is a number plus
 *    a 24px black rule, so it reads as a measurement, not a status light.
 *  - **Zebra striping.** It is the single strongest "this is a default table"
 *    signal there is, and it costs more legibility than it buys at six rows.
 *    Row separation is a hairline, and hover is a 1-step grey fill.
 *
 * The stage colour survives as a 6px dot. That is deliberate and it is the only
 * colour on the page: stage colour is *data* the user configured, not
 * decoration, and dropping it would make the table lie about the pipeline.
 */
export function PipelineTable({
  rows,
  hrefBase,
  openDeals,
  openPipeline,
  avgProbability,
}: {
  rows: DealRow[]
  hrefBase: string
  openDeals: number
  openPipeline: number
  avgProbability: number | null
}) {
  return (
    <Panel>
      <PanelHeader
        label="Top pipeline"
        hint={rows.length ? `${rows.length} largest by value` : undefined}
        actions={
          <Link
            href={`${hrefBase}/deals?view=table`}
            className="inline-flex items-center gap-1 text-[12px] font-bold tracking-[-0.01em] text-foreground transition-opacity duration-150 hover:opacity-60"
          >
            All deals
            <ArrowUpRight className="size-3.5" strokeWidth={2} />
          </Link>
        }
      />

      {rows.length === 0 ? (
        <EmptyState
          title="No deals in your pipeline yet"
          description="Create your first deal to start tracking opportunities, values, and win probability."
          actionHref={{ label: "Go to deals", href: `${hrefBase}/deals` }}
        />
      ) : (
        <>
          {/* `overflow-x-auto` on a `min-w-full` table: the wrapper scrolls, not
              the page. Column hiding is done with responsive classes instead of
              a scroll threshold, because a table that starts scrolling at 900px
              is unreadable on a laptop and a table that drops its value column
              on a phone is useless. */}
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] border-collapse text-left">
              <thead>
                <tr className="border-b border-hairline">
                  <Th className="pl-4">Deal</Th>
                  <Th>Stage</Th>
                  <Th className="hidden lg:table-cell">Owner</Th>
                  <Th align="right">Value</Th>
                  <Th align="right" className="pr-4">
                    Win
                  </Th>
                </tr>
              </thead>
              <tbody>
                {rows.map((deal, i) => (
                  <tr
                    key={deal.id}
                    style={rowEnter(i)}
                    className={cn(
                      "group/row border-b border-hairline transition-colors duration-150 last:border-0 hover:bg-surface-sunken",
                      // The class and the delay travel together, so a row past
                      // the cap gets neither — a row that animated with no delay
                      // would still fire, just all at once.
                      i < ROW_STAGGER_CAP && "animate-row-in"
                    )}
                  >
                    <td className="py-2.5 pr-3 pl-4 align-middle">
                      <Link
                        href={`${hrefBase}/deals/${deal.id}`}
                        className="block truncate text-[13px] font-bold tracking-[-0.012em] text-foreground underline-offset-4 hover:underline"
                      >
                        {deal.title}
                      </Link>
                      <span className="mt-0.5 block truncate text-[11.5px] text-muted-foreground">
                        {deal.organization?.name ??
                          (deal.contact
                            ? `${deal.contact.firstName} ${deal.contact.lastName}`.trim()
                            : "—")}
                      </span>
                    </td>

                    <td className="py-2.5 pr-3 align-middle">
                      <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-[12.5px] text-foreground">
                        <span
                          aria-hidden
                          className="size-[7px] shrink-0 rounded-full"
                          style={{ backgroundColor: deal.stage.color }}
                        />
                        {deal.stage.name}
                      </span>
                    </td>

                    <td className="hidden py-2.5 pr-3 align-middle lg:table-cell">
                      {deal.owner ? (
                        <span className="inline-flex items-center gap-1.5 text-[12.5px] text-muted-foreground">
                          <span
                            aria-hidden
                            className="flex size-[18px] shrink-0 items-center justify-center rounded-full bg-muted text-[8.5px] font-bold text-muted-foreground"
                          >
                            {initials(deal.owner.name)}
                          </span>
                          <span className="max-w-[110px] truncate">{deal.owner.name}</span>
                        </span>
                      ) : (
                        <span className="text-[12.5px] text-muted-foreground/60">—</span>
                      )}
                    </td>

                    <td className="py-2.5 pr-3 text-right align-middle text-[13px] font-bold tabular-nums tracking-[-0.015em] whitespace-nowrap text-foreground">
                      {formatMoneyShort(deal.value, deal.currency)}
                    </td>

                    <td className="py-2.5 pr-4 text-right align-middle">
                      <ProbabilityCell value={deal.probability} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <PanelFooter>
            <FooterMetric label="open deals" value={openDeals} emphasis />
            <FooterMetric label="in pipeline" value={formatMoneyShort(openPipeline)} emphasis />
            <FooterMetric
              label="weighted win"
              value={avgProbability == null ? "—" : `${avgProbability}%`}
            />
          </PanelFooter>
        </>
      )}
    </Panel>
  )
}

/**
 * Probability as a number with a hairline rule under it.
 *
 * A filled bar is the obvious choice and the wrong one: at six rows of
 * different probabilities, six coloured bars turn the table into a
 * heatmap and the eye stops reading the deal names. A number is exact, and the
 * 24px rule is a redundant second channel for the two cases that matter —
 * scanning for "anything above 70" and noticing a deal that has no
 * probability set at all.
 */
function ProbabilityCell({ value }: { value: number | null }) {
  if (value == null) {
    return <span className="text-[12px] text-muted-foreground/60">Not set</span>
  }

  return (
    <span className="inline-flex items-center justify-end gap-2">
      <span aria-hidden className="hidden h-[3px] w-6 overflow-hidden rounded-full bg-muted sm:block">
        <span
          className={cn("block h-full rounded-full", value >= 70 ? "bg-foreground" : "bg-muted-foreground")}
          style={{ width: `${Math.max(4, Math.min(100, value))}%` }}
        />
      </span>
      <span className="w-8 text-right text-[12.5px] font-bold tabular-nums text-foreground">
        {value}%
      </span>
    </span>
  )
}

function Th({
  children,
  className,
  align = "left",
}: {
  children: React.ReactNode
  className?: string
  align?: "left" | "right"
}) {
  return (
    <th
      scope="col"
      className={cn(
        "px-3 py-2 text-[10px] leading-4 font-bold tracking-[0.12em] uppercase text-muted-foreground whitespace-nowrap",
        align === "right" && "text-right",
        className
      )}
    >
      {children}
    </th>
  )
}

/**
 * Staggered row entrance.
 *
 * Only the *delay* is set inline; the animation itself is the shared
 * `.animate-row-in` class from `globals.css`. That split is deliberate — the
 * keyframe and its easing are design-system-wide, so they belong in one place,
 * and a per-row `style` that re-declared the whole `animation` shorthand would
 * be able to drift away from it.
 */
const ROW_STAGGER_CAP = 6

function rowEnter(index: number): React.CSSProperties | undefined {
  if (index >= ROW_STAGGER_CAP) return undefined
  return { animationDelay: `${index * 24}ms` }
}

/* ── Activity feed ───────────────────────────────────────────────────────── */

/**
 * A feed, not a list of badges.
 *
 * The old version rendered each activity's type inside a `Badge`, which put a
 * bordered pill in front of every line — six pills and six hairlines, and the
 * text between them became the least prominent thing on the panel. Here the
 * type is a 9px caps label in a fixed 64px column, so the column is a clean
 * vertical stripe and the body text gets the width.
 */
export function ActivityFeed({
  items,
}: {
  items: { id: string; type: string; body: string | null; createdAt: Date }[]
}) {
  return (
    <div>
      {items.length === 0 ? (
        <EmptyState
          title="No activity yet"
          description="Add contacts or create deals and every call, note, and stage change will land here."
        />
      ) : (
        <ul className="divide-y divide-hairline">
          {items.map((item, i) => (
            <li
              key={item.id}
              style={rowEnter(i)}
              className={cn(
                "flex items-baseline gap-3 px-4 py-2.5",
                i < ROW_STAGGER_CAP && "animate-row-in"
              )}
            >
              <span className="w-[52px] shrink-0 text-[9.5px] leading-4 font-bold tracking-[0.11em] uppercase text-muted-foreground">
                {item.type}
              </span>
              <span className="min-w-0 flex-1 truncate text-[12.5px] leading-5 tracking-[-0.005em] text-foreground">
                {item.body || item.type}
              </span>
              <time
                dateTime={item.createdAt.toISOString()}
                className="shrink-0 text-[11px] whitespace-nowrap text-muted-foreground"
              >
                {relativeTime(item.createdAt)}
              </time>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
