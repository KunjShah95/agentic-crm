"use server"
import { db } from "@/lib/db"
import { requireWorkspaceMember } from "@/lib/permissions"
import { parseUnitsCsv } from "@/lib/csv"
import { auth } from "@/lib/auth"
import { UnitStatus, UnitConfig } from "@/lib/generated/prisma/enums"

/**
 * The status machine, keyed on the generated enum rather than on bare strings.
 *
 * `ALLOWED` used to be `Record<string, string[]>`, so `canTransition(from, to)`
 * accepted anything — a typo in either argument returned `false` rather than
 * failing to compile, which for a status machine means "this transition is
 * illegal" and "this transition does not exist" look identical. Typing the keys
 * and values as `UnitStatus` means a status added to the schema has to be placed
 * here explicitly, which is the point: an unlisted status is a compile error, not
 * a silent dead end.
 */
const ALLOWED: Record<UnitStatus, UnitStatus[]> = {
  [UnitStatus.AVAILABLE]: [UnitStatus.HOLD, UnitStatus.BOOKED],
  [UnitStatus.HOLD]: [UnitStatus.AVAILABLE, UnitStatus.BOOKED],
  [UnitStatus.BOOKED]: [UnitStatus.SOLD],
  [UnitStatus.SOLD]: [],
}

/** Narrow a raw CSV cell to an enum member, falling back when it is not one. */
function toEnum<T extends string>(value: string | undefined, allowed: readonly T[], fallback: T): T {
  const v = (value ?? "").trim().toUpperCase()
  return (allowed as readonly string[]).includes(v) ? (v as T) : fallback
}

const UNIT_STATUSES = Object.values(UnitStatus) as UnitStatus[]
const UNIT_CONFIGS = Object.values(UnitConfig) as UnitConfig[]

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
  const project = await db.project.findFirst({ where: { id: projectId, workspaceId } })
  if (!project) throw new Error("Project not found in this workspace")
  const rows = parseUnitsCsv(csv)
  let created = 0
  for (const r of rows) {
    await db.unit.create({
      data: {
        workspaceId,
        projectId,
        unitNo: r.unitNo,
        /* Validated rather than cast. `parseUnitsCsv` returns every cell as a string,
         so `r.config` is `string` and was passed to a Prisma enum with `as any`.
         That compiled, and then wrote whatever the spreadsheet contained straight
         into a Postgres enum column: a typo like "3BHK" or a lowercase "sold"
         became a runtime constraint violation naming a column the caller never
         mentioned, one row at a time, halfway through an import.

         `toEnum` normalises case and falls back to the default for anything
         unrecognised, so a messy spreadsheet imports cleanly with the documented
         defaults rather than aborting. */
        config: toEnum(r.config, UNIT_CONFIGS, UnitConfig.BHK2),
        price: Number(r.price) || 0,
        status: toEnum(r.status, UNIT_STATUSES, UnitStatus.AVAILABLE),
      },
    })
    created++
  }
  return { created }
}

export function canTransition(from: UnitStatus, to: UnitStatus) {
  return ALLOWED[from].includes(to)
}
