import { db } from "@/lib/db"
export async function listProjects(workspaceId: string) {
  return db.project.findMany({ where: { workspaceId }, orderBy: { createdAt: "desc" }, include: { towers: true, _count: { select: { units: true } } } })
}
export async function listUnits(workspaceId: string, filters: { projectId?: string; status?: string; config?: string; minPrice?: number; maxPrice?: number; search?: string } = {}) {
  return db.unit.findMany({
    where: {
      workspaceId,
      ...(filters.projectId ? { projectId: filters.projectId } : {}),
      ...(filters.status ? { status: filters.status as any } : {}),
      ...(filters.config ? { config: filters.config as any } : {}),
      ...(filters.minPrice || filters.maxPrice ? { price: { gte: filters.minPrice, lte: filters.maxPrice } } : {}),
      ...(filters.search ? { unitNo: { contains: filters.search, mode: "insensitive" } } : {}),
    },
    orderBy: { unitNo: "asc" },
    include: { floor: true, project: true },
  })
}
