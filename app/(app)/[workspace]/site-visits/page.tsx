import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { db } from "@/lib/db"
import { listSiteVisits } from "@/modules/siteVisits/queries"
import { ScheduleVisitDialog, CheckInButton } from "@/components/site-visits/site-visit-panel"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"

export const metadata: Metadata = { title: "Site Visits" }

export default async function SiteVisitsPage({ params }: { params: Promise<{ workspace: string }> }) {
  const { workspace: slug } = await params
  const ws = await db.workspace.findUnique({ where: { slug } })
  if (!ws) notFound()

  const [visits, contacts] = await Promise.all([
    listSiteVisits(ws.id),
    db.contact.findMany({ where: { workspaceId: ws.id }, orderBy: { firstName: "asc" }, select: { id: true, firstName: true, lastName: true }, take: 500 }),
  ])

  return (
    <div className="space-y-6">
      <div className="rounded-[20px] border bg-card p-5 md:p-6 relative overflow-hidden">
        <div aria-hidden className="pointer-events-none absolute inset-0">
          <div className="absolute -top-16 -right-16 h-48 w-64 rounded-full bg-gradient-to-br from-emerald-500/10 via-blue-500/10 to-violet-500/10 blur-2xl" />
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-emerald-500/20 to-transparent" />
        </div>
        <div className="relative flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-[22px] font-semibold tracking-tight">Site Visits</h1>
            <p className="mt-1 text-sm text-muted-foreground">{visits.length} scheduled · GPS check-in with 200m geofence · site_visit channel.</p>
          </div>
          <ScheduleVisitDialog workspaceId={ws.id} contacts={contacts} />
        </div>
      </div>

      <div className="rounded-xl border bg-card overflow-hidden">
        <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Lead</TableHead>
            <TableHead>Scheduled</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Outcome</TableHead>
            <TableHead className="text-right">Action</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {visits.length === 0 ? (
            <TableRow>
              <TableCell colSpan={5} className="text-sm text-muted-foreground">
                No site visits yet.
              </TableCell>
            </TableRow>
          ) : (
            visits.map((v) => {
              const verified = (v.gps as { verified?: boolean } | null)?.verified
              return (
                <TableRow key={v.id}>
                  <TableCell className="font-medium">
                    {v.lead.firstName} {v.lead.lastName}
                  </TableCell>
                  <TableCell>{new Date(v.scheduledAt).toLocaleString("en-IN")}</TableCell>
                  <TableCell>
                    {v.checkedInAt ? (
                      <Badge variant={verified === false ? "destructive" : "default"}>
                        {verified === false ? "Checked in (off-site)" : "Checked in"}
                      </Badge>
                    ) : (
                      <Badge variant="secondary">Scheduled</Badge>
                    )}
                  </TableCell>
                  <TableCell>{v.outcome ?? "—"}</TableCell>
                  <TableCell className="text-right">
                    {v.checkedInAt ? null : <CheckInButton workspaceId={ws.id} siteVisitId={v.id} />}
                  </TableCell>
                </TableRow>
              )
            })
          )}
        </TableBody>
      </Table>
      </div>
    </div>
  )
}
