import Link from "next/link"
import { notFound } from "next/navigation"
import { db } from "@/lib/db"
import { listUnits } from "@/modules/property/queries"
import { InventoryWithDrawer } from "@/components/property/InventoryWithDrawer"
import { PageHeader, Stat } from "@/components/shell/page-header"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Building2, Layers, ArrowLeft } from "lucide-react"

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ workspace: string; projectId: string }>
}) {
  const { workspace: slug, projectId } = await params

  const ws = await db.workspace.findUnique({ where: { slug } })
  if (!ws) notFound()

  const project = await db.project.findFirst({
    where: { id: projectId, workspaceId: ws.id },
  })
  if (!project) notFound()

  const units = await listUnits(ws.id, { projectId: project.id })
  const avail = units.filter((u) => u.status === "AVAILABLE").length
  const hold = units.filter((u) => u.status === "HOLD").length

  return (
    <div className="space-y-6">
      <PageHeader
        title={
          <span className="flex items-center gap-2">
            <Link href={`/${slug}/projects`} className="inline-flex size-7 items-center justify-center rounded-full border bg-card hover:bg-muted">
              <ArrowLeft className="size-3.5" />
            </Link>
            {project.name}
          </span>
        }
        description={`${project.reraNo ?? "RERA TBD"} · ${project.city} · ${units.length} units`}
        badge={<Badge variant="secondary" className="rounded-full">{project.type ?? "RESIDENTIAL"}</Badge>}
        stats={
          <>
            <Stat label="Units" value={units.length} sub={`${avail} available · ${hold} hold`} icon={<Layers className="size-3" />} />
            <Stat label="Project" value={project.name.slice(0, 18)} sub={project.city} icon={<Building2 className="size-3" />} />
          </>
        }
      />
      {units.length === 0 ? (
        <div className="rounded-xl border border-dashed bg-card py-10 text-center text-sm text-muted-foreground">No units yet — import CSV or create manually.</div>
      ) : (
        <InventoryWithDrawer units={units as unknown as never[]} />
      )}
    </div>
  )
}
