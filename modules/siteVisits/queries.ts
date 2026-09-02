import { db } from "@/lib/db"

/** Upcoming + past site visits, newest scheduled first. */
export async function listSiteVisits(workspaceId: string) {
  return db.siteVisit.findMany({
    where: { workspaceId },
    orderBy: { scheduledAt: "desc" },
    take: 200,
    select: {
      id: true,
      scheduledAt: true,
      checkedInAt: true,
      outcome: true,
      notes: true,
      gps: true,
      lead: { select: { id: true, firstName: true, lastName: true, phone: true } },
      unitId: true,
      dealId: true,
    },
  })
}
