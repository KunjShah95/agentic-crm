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
  await authed(workspaceId)
  const p = towerSchema.parse(data)
  return db.tower.create({ data: p })
}
export async function createFloor(input: { workspaceId: string; data: unknown }) {
  const { workspaceId, data } = input
  await authed(workspaceId)
  const p = floorSchema.parse(data)
  return db.floor.create({ data: p })
}
export async function createUnit(input: { workspaceId: string; data: unknown }) {
  const { workspaceId, data } = input
  await authed(workspaceId)
  const p = unitSchema.parse(data) as any
  const unit = await db.unit.create({ data: { ...p, workspaceId, floorId: p.floorId || null } })
  revalidatePath(`/${workspaceId}/projects/${p.projectId}`)
  return unit
}
export async function updateUnitStatus(input: { workspaceId: string; data: unknown }) {
  const { workspaceId, data } = input
  await authed(workspaceId)
  const { unitId, status, holdUntil } = updateUnitStatusSchema.parse(data)
  const unit = await db.unit.update({ where: { id: unitId }, data: { status: status as any, holdUntil } })
  await db.activity.create({ data: { workspaceId, type: "NOTE", body: `Unit ${unit.unitNo} → ${status}`, createdBy: "system", source: "system" } })
  return unit
}
