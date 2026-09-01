import { notFound } from "next/navigation"
import { db } from "@/lib/db"
import { listUnits } from "@/modules/property/queries"
import { InventoryWithDrawer } from "@/components/property/InventoryWithDrawer"

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

  return (
    <div className="p-6 space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">{project.name}</h1>
        <p className="text-sm text-muted-foreground">
          {project.reraNo ?? "RERA TBD"} · {project.city} · {units.length} units
        </p>
      </div>
      {units.length === 0 ? (
        <p className="text-sm text-muted-foreground">No units yet.</p>
      ) : (
        <InventoryWithDrawer units={units as unknown as never[]} />
      )}
    </div>
  )
}
