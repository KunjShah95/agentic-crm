import { db } from "@/lib/db"
import type { UnitConfig, UnitStatus } from "@/lib/generated/prisma/enums"
export async function listProjects(workspaceId: string) {
  return db.project.findMany({ where: { workspaceId }, orderBy: { createdAt: "desc" }, include: { towers: true, _count: { select: { units: true } } } })
}
export async function listUnits(
  workspaceId: string,
  /* `status` and `config` are typed as the generated enums rather than `string`.
     The filters arrive from a URL query string, so the caller narrows them —
     this function is no longer the place where an arbitrary string gets pushed
     into an enum column behind an `as any`, which is what made an unrecognised
     `?status=` value a database error instead of an ignored filter. */
  filters: {
    projectId?: string
    status?: UnitStatus
    config?: UnitConfig
    minPrice?: number
    maxPrice?: number
    search?: string
  } = {},
) {
  return db.unit.findMany({
    where: {
      workspaceId,
      ...(filters.projectId ? { projectId: filters.projectId } : {}),
      ...(filters.status ? { status: filters.status } : {}),
      ...(filters.config ? { config: filters.config } : {}),
      ...(filters.minPrice || filters.maxPrice ? { price: { gte: filters.minPrice, lte: filters.maxPrice } } : {}),
      ...(filters.search ? { unitNo: { contains: filters.search, mode: "insensitive" } } : {}),
    },
    orderBy: { unitNo: "asc" },
    include: { floor: true, project: true },
  })
}
