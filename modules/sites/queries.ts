import { db } from "@/lib/db"

export async function getPublicProject(workspaceSlug: string, projectId: string) {
  const ws = await db.workspace.findUnique({ where: { slug: workspaceSlug } })
  if (!ws) return null
  const project = await db.project.findFirst({ where: { id: projectId, workspaceId: ws.id } })
  if (!project) return null
  const units = await db.unit.findMany({ where: { projectId, status: "AVAILABLE" }, orderBy: { unitNo: "asc" }, select: { id: true, unitNo: true, config: true, carpetArea: true, price: true, status: true } })
  return { workspace: ws, project, units }
}
