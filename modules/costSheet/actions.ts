"use server"
import { db } from "@/lib/db"
import { requireWorkspaceMember } from "@/lib/permissions"
import { costSheetSchema } from "@/lib/validators/re"
import { calcTotal } from "./calc"
import { auth } from "@/lib/auth"

export async function generateCostSheet({ workspaceId, data }: { workspaceId: string; data: unknown }) {
  const s = await auth()
  if (!s?.user?.id) throw new Error("Unauthorized")
  await requireWorkspaceMember(workspaceId, s.user.id)
  /* No cast: `otherCharges` is validated as `Record<string, number>`, which is
     what Prisma's Json column accepts here. The `as any` was on the whole parsed
     object, which meant it also covered `basePrice`, `gst` and `stampDuty` —
     three numbers that the client would have rejected if any of them were wrong.
     One cast cannot be narrower than its target, so a cast on the object is a
     cast on all of it. */
  const p = costSheetSchema.parse(data)
  const unit = await db.unit.findFirst({ where: { id: p.unitId, workspaceId } })
  if (!unit) throw new Error("Unit not found in this workspace")
  const total = calcTotal({ basePrice: p.basePrice, gst: p.gst, stampDuty: p.stampDuty, otherCharges: p.otherCharges })
  const existing = await db.costSheet.count({ where: { unitId: p.unitId } })
  const sheet = await db.costSheet.create({ data: { ...p, workspaceId, total, version: existing + 1, otherCharges: p.otherCharges ?? {} } })
  await db.activity.create({ data: { workspaceId, type: "NOTE", body: `Cost sheet v${sheet.version} generated: ₹${total.toLocaleString("en-IN")}`, createdBy: s.user.id, source: "system" } })
  return sheet
}
