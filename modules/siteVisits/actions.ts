"use server"

import { db } from "@/lib/db"
import { requireWorkspaceMember } from "@/lib/permissions"
import { auth } from "@/lib/auth"
import { revalidatePath } from "next/cache"
import { siteVisitSchema, checkInSchema } from "@/lib/validators/re"
import { withinRadius, type LatLng } from "./gps"

async function authed(workspaceId: string) {
  const s = await auth()
  if (!s?.user?.id) throw new Error("Unauthorized")
  await requireWorkspaceMember(workspaceId, s.user.id)
  return s.user.id
}

/** Schedule a site visit for a lead. */
export async function scheduleVisit(input: { workspaceId: string; data: unknown }) {
  await authed(input.workspaceId)
  const p = siteVisitSchema.parse(input.data)
  return db.siteVisit.create({
    data: {
      workspaceId: input.workspaceId,
      leadId: p.leadId,
      unitId: p.unitId || null,
      dealId: p.dealId || null,
      scheduledAt: p.scheduledAt,
      notes: p.notes || null,
    },
  })
}

/**
 * GPS check-in for a scheduled visit. Records the coordinates + checkedInAt and
 * flags whether the check-in is within a 200m geofence of the site (if the
 * visit carries a site location in gps.site). Logs a SITE_VISIT activity.
 */
export async function checkIn(input: { workspaceId: string; data: unknown }) {
  const userId = await authed(input.workspaceId)
  const p = checkInSchema.parse(input.data)
  const visit = await db.siteVisit.findFirst({ where: { id: p.siteVisitId, workspaceId: input.workspaceId } })
  if (!visit) throw new Error("Site visit not found")

  const point: LatLng = { lat: p.lat, lng: p.lng }
  const site = (visit.gps as { site?: LatLng } | null)?.site
  const verified = site ? withinRadius(site, point, 200) : true

  const updated = await db.siteVisit.update({
    where: { id: visit.id },
    data: {
      checkedInAt: new Date(),
      gps: { ...(visit.gps as object | null), checkIn: point, verified },
      outcome: p.outcome || visit.outcome,
    },
  })

  await db.activity.create({
    data: {
      workspaceId: input.workspaceId,
      type: "NOTE",
      contactId: visit.leadId,
      dealId: visit.dealId,
      body: `Site visit check-in${verified ? "" : " (outside geofence)"} at ${p.lat.toFixed(5)},${p.lng.toFixed(5)}`,
      source: "system",
      channel: "SITE_VISIT",
      createdBy: userId,
    },
  })

  revalidatePath(`/${input.workspaceId}/site-visits`)
  return { siteVisitId: updated.id, verified }
}
