import { notFound } from "next/navigation"
import { Plus } from "lucide-react"

import { db } from "@/lib/db"
import { listProjects } from "@/modules/property/queries"
import { ButtonLink } from "@/components/ds/button"
import { Masthead, type MastheadFigure } from "@/components/ds/masthead"
import { Panel, PanelHeader } from "@/components/ds/panel"
import { ProjectListing } from "@/components/projects/project-listing"

export default async function ProjectsPage({
  params,
}: {
  params: Promise<{ workspace: string }>
}) {
  const { workspace: slug } = await params
  const ws = await db.workspace.findUnique({ where: { slug } })
  if (!ws) notFound()

  const projects = await listProjects(ws.id)
  const rows = projects.map((p) => {
    const project = p as unknown as { _count: { units: number } }
    return {
      id: p.id,
      name: p.name,
      city: p.city,
      reraNo: p.reraNo,
      unitCount: project._count.units,
    }
  })

  const totalUnits = rows.reduce((s, p) => s + p.unitCount, 0)
  const registered = rows.filter((p) => p.reraNo).length

  const figures: MastheadFigure[] = [
    { label: "Projects", value: rows.length, sub: "in this workspace" },
    { label: "Units", value: totalUnits, sub: "across every project" },
    { label: "Cities", value: new Set(rows.map((p) => p.city)).size, sub: "locations covered" },
    {
      label: "RERA registered",
      value: `${registered}/${rows.length}`,
      sub: registered === rows.length && rows.length > 0 ? "all clear" : "some pending",
    },
  ]

  return (
    <div className="space-y-4">
      {/*
        `paper` tone, not the black band. A solid black header above a grid of
        white project cards puts two competing containers on the screen and the
        cards stop reading as the subject. The black belongs to the rail and to
        the dashboard's numbers; a listing page needs to be paper.
      */}
      <Masthead
        tone="paper"
        eyebrow={
          <>
            <span className="size-[5px] rounded-full bg-[#0d0d0d]" />
            Inventory
          </>
        }
        title="Projects"
        description="Every tower, unit, price, and payment plan in this workspace. Open a project to work its inventory."
        actions={
          <ButtonLink size="sm" href={`/${slug}/bookings`}>
            <Plus data-icon="inline-start" className="size-3.5" strokeWidth={2.2} />
            New booking
          </ButtonLink>
        }
        figures={figures}
      />

      <Panel>
        <PanelHeader
          label="All projects"
          hint={rows.length ? undefined : "Nothing here yet"}
        />
        <div className="p-4">
          <ProjectListing projects={rows} hrefBase={`/${slug}`} />
        </div>
      </Panel>
    </div>
  )
}
