"use server"
import { db } from "@/lib/db"
import { requireWorkspaceMember } from "@/lib/permissions"
import { projectSchema, towerSchema, floorSchema, unitSchema, updateUnitStatusSchema } from "@/lib/validators/re"
import { auth } from "@/lib/auth"
import { revalidatePath } from "next/cache"

async function authed(workspaceId: string) {
  const s = await auth()
  if (!s?.user?.id) throw new Error("Unauthorized")
  await requireWorkspaceMember(workspaceId, s.user.id)
  return s.user.id
}

export async function createProject({ workspaceId, data }: { workspaceId: string; data: unknown }) {
  await authed(workspaceId)
  const parsed = projectSchema.parse(data)
  const project = await db.project.create({ data: { ...parsed, workspaceId } })
  await db.activity.create({ data: { workspaceId, type: "NOTE", body: `Project created: ${project.name}`, createdBy: "system", source: "system" } })
  revalidatePath(`/${workspaceId}/projects`)
  return project
}
export async function createTower(input: { workspaceId: string; data: unknown }) {
  const { workspaceId, data } = input
  const userId = await authed(workspaceId)
  const p = towerSchema.parse(data)
  const project = await db.project.findFirst({ where: { id: p.projectId, workspaceId } })
  if (!project) throw new Error("Project not found in this workspace")
  const tower = await db.tower.create({ data: p })
  await db.activity.create({ data: { workspaceId, type: "NOTE", body: `Tower created: ${tower.name}`, createdBy: userId, source: "system" } })
  return tower
}
export async function createFloor(input: { workspaceId: string; data: unknown }) {
  const { workspaceId, data } = input
  const userId = await authed(workspaceId)
  const p = floorSchema.parse(data)
  const tower = await db.tower.findFirst({ where: { id: p.towerId }, include: { project: true } })
  if (!tower || tower.project.workspaceId !== workspaceId) throw new Error("Tower not found in this workspace")
  return db.floor.create({ data: p })
}
export async function createUnit(input: { workspaceId: string; data: unknown }) {
  const { workspaceId, data } = input
  const userId = await authed(workspaceId)
  const p = unitSchema.parse(data) as any
  const project = await db.project.findFirst({ where: { id: p.projectId, workspaceId } })
  if (!project) throw new Error("Project not found in this workspace")
  if (p.floorId) {
    const floor = await db.floor.findFirst({ where: { id: p.floorId }, include: { tower: { include: { project: true } } } })
    if (!floor || floor.tower.project.workspaceId !== workspaceId) throw new Error("Floor not found in this workspace")
  }
  const unit = await db.unit.create({ data: { ...p, workspaceId, floorId: p.floorId || null } })
  await db.activity.create({ data: { workspaceId, type: "NOTE", body: `Unit created: ${unit.unitNo}`, createdBy: userId, source: "system" } })
  revalidatePath(`/${workspaceId}/projects/${p.projectId}`)
  return unit
}
export async function updateUnitStatus(input: { workspaceId: string; data: unknown }) {
  const { workspaceId, data } = input
  const userId = await authed(workspaceId)
  const { unitId, status, holdUntil } = updateUnitStatusSchema.parse(data)
  const existing = await db.unit.findFirst({ where: { id: unitId, workspaceId } })
  if (!existing) throw new Error("Unit not found in this workspace")
  const { canTransition } = await import("./import")
  if (!canTransition(existing.status as string, status as string)) {
    throw new Error(`Invalid status transition: ${existing.status} → ${status}`)
  }
  const unit = await db.unit.update({ where: { id: unitId }, data: { status: status as any, holdUntil } })
  await db.activity.create({ data: { workspaceId, type: "NOTE", body: `Unit ${unit.unitNo} ${existing.status} → ${status}`, createdBy: userId, source: "system" } })
  return unit
}
