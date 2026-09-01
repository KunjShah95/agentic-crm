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
  const p = costSheetSchema.parse(data) as any
  const total = calcTotal({ basePrice: p.basePrice, gst: p.gst, stampDuty: p.stampDuty, otherCharges: p.otherCharges })
  const existing = await db.costSheet.count({ where: { unitId: p.unitId } })
  const sheet = await db.costSheet.create({ data: { ...p, workspaceId, total, version: existing + 1, otherCharges: p.otherCharges ?? {} } })
  await db.activity.create({ data: { workspaceId, type: "NOTE", body: `Cost sheet v${sheet.version} generated: ₹${total.toLocaleString("en-IN")}`, createdBy: s.user.id, source: "system" } })
  return sheet
}
