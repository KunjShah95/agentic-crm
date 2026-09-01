"use server"
import { db } from "@/lib/db"
import { requireWorkspaceMember } from "@/lib/permissions"
import { parseUnitsCsv } from "@/lib/csv"
import { auth } from "@/lib/auth"

const ALLOWED: Record<string, string[]> = {
  AVAILABLE: ["HOLD", "BOOKED"],
  HOLD: ["AVAILABLE", "BOOKED"],
  BOOKED: ["SOLD"],
  SOLD: [],
}

export async function importUnitsCsv({
  workspaceId,
  projectId,
  csv,
}: {
  workspaceId: string
  projectId: string
  csv: string
}) {
  const s = await auth()
  if (!s?.user?.id) throw new Error("Unauthorized")
  await requireWorkspaceMember(workspaceId, s.user.id)
  const rows = parseUnitsCsv(csv)
  let created = 0
  for (const r of rows) {
    await db.unit.create({
      data: {
        workspaceId,
        projectId,
        unitNo: r.unitNo,
        config: (r.config as any) ?? "BHK2",
        price: Number(r.price) || 0,
        status: (r.status as any) ?? "AVAILABLE",
      },
    })
    created++
  }
  return { created }
}

export function canTransition(from: string, to: string) {
  return (ALLOWED[from] ?? []).includes(to)
}
