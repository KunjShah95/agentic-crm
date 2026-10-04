import { db } from "@/lib/db"
import { brokerScopeFilter, type ViewerScope } from "@/lib/permissions"

/**
 * Upcoming + past site visits, newest scheduled first.
 *
 * Broker-scoped through the visit's deal. A `SiteVisit` row carries the lead's
 * name and phone, free-text `notes`, the GPS fix, and the outcome — so an
 * unscoped list discloses where a broker's colleague met a customer and what was
 * said. Visits with no deal yet stay visible to every role, matching the
 * deal-less rule used by the dashboard activity feed.
 */
export async function listSiteVisits(scope: ViewerScope) {
  return db.siteVisit.findMany({
    where:
      scope.role === "BROKER"
        ? {
            workspaceId: scope.workspaceId,
            OR: [
              { dealId: null },
              { deal: { workspaceId: scope.workspaceId, ...brokerScopeFilter(scope.role, scope.brokerId) } },
            ],
          }
        : { workspaceId: scope.workspaceId },
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
