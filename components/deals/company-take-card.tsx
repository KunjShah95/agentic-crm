import { Fragment } from "react"
import { HandCoins } from "lucide-react"

import { Card, CardContent } from "@/components/ui/card"
import { formatMoney } from "@/lib/format"
import type { pipelineStats } from "@/modules/deals/queries"
import { DEAL_TYPES, type DealType } from "@/modules/deals/commission"

type Take = Awaited<ReturnType<typeof pipelineStats>>["take"]

const TYPE_LABELS: Record<DealType, string> = {
  PLOT: "Land / Plot",
  VILLA: "Villa",
  BUNGALOW: "Bungalow",
  FLAT: "Flat",
  SHOP: "Shop",
  COMMERCIAL: "Commercial",
  OFFICE: "Office",
  CORPORATE_HOUSE: "Corporate house",
}

export function CompanyTakeCard({ take }: { take: Take }) {
  const typeBits = take.byType.map(
    (row) =>
      `${TYPE_LABELS[row.type as DealType] ?? row.type} ${row.avgPct
        .toFixed(2)
        .replace(/\.?0+$/, "")}%×${row.count} ${formatMoney(row.take)}`
  )

  return (
    <Card className="border-dashed">
      <CardContent className="flex h-full flex-col gap-1 py-3">
        <div className="flex items-center gap-2">
          <HandCoins className="size-4 shrink-0 text-brand" />
          <span className="text-[11px] font-medium tracking-[0.08em] text-muted-foreground uppercase">
            Company take (Won)
          </span>
        </div>
        <p className="text-sm leading-snug">
          <span className="font-semibold tracking-tight whitespace-nowrap">
            {formatMoney(take.total)}
          </span>{" "}
          <span className="text-xs leading-relaxed text-muted-foreground">
            {take.committed > 0 && (
              <>
                {`${formatMoney(take.committed)} assigned · ${formatMoney(take.projected)} projected`}
                {typeBits.length > 0 && " — "}
              </>
            )}
            {typeBits.map((bit, i) => (
              <Fragment key={i}>
                {i > 0 && " · "}
                <span className="whitespace-nowrap">{bit}</span>
              </Fragment>
            ))}
          </span>
        </p>
        {take.byDeal.length > 0 && (
          <ul className="space-y-0.5 text-xs leading-relaxed text-muted-foreground">
            {take.byDeal.map((deal) => (
              <li
                key={`${deal.name}-${deal.take}`}
                className="flex items-baseline justify-between gap-2"
              >
                <span className="truncate" title={deal.name}>
                  {deal.name}
                  <span className="ml-1 text-[10px] opacity-70">
                    ({TYPE_LABELS[deal.type as DealType] ?? deal.type}
                    {deal.assigned ? " · assigned" : " · projected"})
                  </span>
                </span>
                <span className="shrink-0 font-mono tabular-nums">
                  {formatMoney(deal.take)}
                </span>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-auto text-[10px] leading-snug text-muted-foreground/70">
          Weighting: {DEAL_TYPES.length} categories · land 3% → corporate 1.5% ·
          urgency ±0–1pp. Assigned CP commissions always override the projection.
        </p>
      </CardContent>
    </Card>
  )
}
