import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { Plus, ArrowUpRight } from "lucide-react"

import { db } from "@/lib/db"
import { formatMoneyShort } from "@/lib/format"
import { resolveViewerScope } from "@/lib/permissions"
import { auth } from "@/lib/auth"
import { getDashboardData } from "@/modules/dashboard/queries"
import { ButtonLink } from "@/components/ds/button"
import { Masthead, type MastheadFigure } from "@/components/ds/masthead"
import { Panel, PanelHeader } from "@/components/ds/panel"
import {
  LeadSourceDonut,
  PipelineByStageChart,
  WinProbabilityGauge,
  WonRevenueChart,
} from "@/components/dashboard/charts"
import { ActivityFeed, PipelineTable } from "@/components/dashboard/pipeline-table"
import { ProjectListing } from "@/components/projects/project-listing"

export const metadata: Metadata = { title: "Dashboard" }

export default async function DashboardPage({ params }: { params: Promise<{ workspace: string }> }) {
  const { workspace: slug } = await params
  const ws = await db.workspace.findUnique({ where: { slug } })
  if (!ws) notFound()

  const session = await auth()
  const scope = session?.user?.id ? await resolveViewerScope(ws.id, session.user.id) : null
  if (!scope) notFound()

  const data = await getDashboardData(scope)
  const { counts } = data
  const money = (value: number | null | undefined) => formatMoneyShort(value, data.currency)

  /*
   * The Won figure's sub-line used to read `wonByMonth.at(-1)` — the *current*
   * month bucket — which is `₹0` for any workspace that has not closed a deal
   * in the current calendar month, and "₹0 this month" is indistinguishable
   * from "we track this and it is genuinely nothing" when what it actually
   * means is "the seed data was written in September".
   *
   * So it names the most recent month that *has* a value, and says plainly when
   * the six-month window has none. The big number above stays all-time; the two
   * lines deliberately say different things.
   */
  const lastWon = [...data.wonByMonth].reverse().find((m) => m.value > 0)
  const wonSub =
    counts.wonDeals === 0
      ? "nothing closed yet"
      : lastWon
        ? `${money(lastWon.value)} in ${lastWon.label}`
        : "no wins in the last 6 months"

  // Deals held in another currency cannot be summed into the totals above
  // without an FX rate this codebase does not have, so they are excluded from
  // the money and disclosed here instead of quietly vanishing from the count.
  const currencyNote =
    data.foreignCurrencyDeals > 0
      ? `${data.foreignCurrencyDeals} open deal${data.foreignCurrencyDeals === 1 ? "" : "s"} held outside ${data.currency} and excluded from these totals`
      : null

  // The date goes in the eyebrow rather than in a "Last updated: …" line. A
  // fresh-workspace reading of a timestamp makes people distrust the numbers
  // underneath it; a plain date in the corner is honest without being alarming.
  const today = new Intl.DateTimeFormat("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "short",
  }).format(new Date())

  const figures: MastheadFigure[] = [
    {
      label: "Open pipeline",
      value: money(data.openPipeline),
      sub: `${counts.openDeals} ${counts.openDeals === 1 ? "deal" : "deals"} in play`,
      href: `/${slug}/deals?view=board`,
    },
    {
      label: "Won",
      value: counts.wonDeals,
      sub: `all time, ${wonSub}`,
      href: `/${slug}/deals`,
    },
    {
      label: "Contacts",
      value: counts.contacts,
      sub: `${counts.tasks} open ${counts.tasks === 1 ? "task" : "tasks"}`,
      href: `/${slug}/contacts`,
    },
    {
      label: "Projects",
      value: counts.projects,
      sub: `${counts.units} units listed`,
      href: `/${slug}/projects`,
    },
    {
      label: "Site visits",
      value: counts.siteVisits,
      sub: "logged to date",
      href: `/${slug}/site-visits`,
    },
  ]

  return (
    <div className="space-y-4">
      <Masthead
        eyebrow={
          <>
            <span className="size-[5px] rounded-full bg-white" />
            {ws.name}
            <span className="text-white/25">/</span>
            {today}
          </>
        }
        title="Dashboard"
        description="What is live, what is at risk, and what to do next. Everything below is scoped to this workspace."
        actions={
          <>
            <ButtonLink
              variant="inverse-outline"
              size="sm"
              href={`/${slug}/reports`}
            >
              Reports
              <ArrowUpRight data-icon="inline-end" className="size-3.5" strokeWidth={2} />
            </ButtonLink>
            <ButtonLink variant="inverse" size="sm" href={`/${slug}/contacts`}>
              <Plus data-icon="inline-start" className="size-3.5" strokeWidth={2.2} />
              New contact
            </ButtonLink>
          </>
        }
        figures={figures}
      />

      {/*
        Charts first, tables second. A dashboard's job is to answer "is anything
        wrong" in one look, and that is a shape question before it is a list
        question — so the two big shapes (trend, gauge) sit at the top where
        they are unmissable, and the two supporting breakdowns sit beneath them
        at the same weight as each other.
      */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Panel className="lg:col-span-2">
          <PanelHeader
            label="Won value"
            hint="Last 6 months, by the month each deal was won"
            actions={
              <span className="text-[11.5px] tabular-nums text-[#a8a8a8]">
                {data.wonByMonth.reduce((s, m) => s + m.count, 0)} deals
              </span>
            }
          />
          {/* A `min-h` floor, not a hard height, for the same reason the
              pipeline chart below uses one: this Panel stretches to the taller
              Win-probability cell beside it, and a fixed height left the area
              between the axis and the panel edge empty. The floor keeps the
              plot area from collapsing to nothing on a short row. */}
          <div className="min-h-[232px] flex-1 px-2 pt-4 pb-3">
            <WonRevenueChart data={data.wonByMonth} currency={data.currency} />
          </div>
        </Panel>

        <Panel>
          <PanelHeader label="Win probability" hint="Value-weighted" />
          {/* `flex-1` + centred: the gauge is a fixed 168px square, so in a
              panel stretched to match the taller area chart beside it, the
              extra space otherwise all lands below the footnote. */}
          <div className="flex flex-1 flex-col justify-center px-4 pt-5 pb-4">
            <WinProbabilityGauge value={data.winProbability} />
            <p className="mt-3 border-t border-[#f0f0f0] pt-3 text-[11.5px] leading-relaxed text-[#8a8a8a]">
              Weighted by deal value, so a ₹2 Cr opportunity counts for more than a
              ₹20 L one. Deals with no probability set are excluded.
            </p>
          </div>
        </Panel>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Panel className="lg:col-span-2">
          <PanelHeader
            label="Pipeline by stage"
            hint="Open and closed deals per stage"
            actions={
              <span className="text-[11.5px] tabular-nums text-[#a8a8a8]">
                {money(data.openPipeline)} open
              </span>
            }
          />
          {/*
            `flex-1` with a `min-h` floor, not a fixed height. This panel is a
            grid item beside the donut, so it stretches to the taller of the
            two; a hard `h-[214px]` left the chart pinned to the top with ~200px
            of dead white below it. The floor keeps the chart legible when the
            donut is the shorter cell, and the flex lets it take up the slack
            when it is the taller one.
          */}
          <div className="min-h-[214px] flex-1 px-2 pt-4 pb-3">
            <PipelineByStageChart data={data.stages} />
          </div>
          {currencyNote ? (
            <p className="border-t border-[#f0f0f0] px-4 py-2.5 text-[11.5px] leading-relaxed text-[#8a8a8a]">
              {currencyNote}
            </p>
          ) : null}
        </Panel>

        <Panel>
          <PanelHeader label="Lead sources" hint="Where contacts came from" />
          {/* `flex-1` so the donut is vertically centred in whatever height the
              row settles at, rather than clinging to the top of a stretched
              panel. `centerContent` on a column flex pushes the remaining space
              above and below equally. */}
          <div className="flex flex-1 items-center px-4 pt-4 pb-4">
            <LeadSourceDonut data={data.leadSources} />
          </div>
        </Panel>
      </div>

      <PipelineTable
        rows={data.topDeals}
        hrefBase={`/${slug}`}
        openDeals={counts.openDeals}
        openPipeline={data.openPipeline}
        currency={data.currency}
        avgProbability={data.winProbability}
      />

      <Panel>
        <PanelHeader label="Recent projects" hint="Inventory you are actively working" />
        <div className="p-4">
          <ProjectListing
            hrefBase={`/${slug}`}
            searchable={false}
            projects={data.projects.map((p) => ({
              id: p.id,
              name: p.name,
              city: p.city,
              reraNo: p.reraNo,
              unitCount: p._count.units,
            }))}
          />
        </div>
      </Panel>

      <Panel>
        <PanelHeader label="Recent activity" hint="Across contacts and deals" />
        <ActivityFeed items={data.recentActivity} />
      </Panel>
    </div>
  )
}
