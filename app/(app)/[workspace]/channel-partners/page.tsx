import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { listChannelPartners, listCommissions, resolveCpId } from "@/modules/channelPartners/queries"
import { listBookings } from "@/modules/booking/queries"
import { CpToolbar } from "@/components/channel-partners/cp-panel"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"

export const metadata: Metadata = { title: "Channel Partners" }

const inr = (n?: number | null) => (n == null ? "—" : `₹${n.toLocaleString("en-IN")}`)

export default async function ChannelPartnersPage({ params }: { params: Promise<{ workspace: string }> }) {
  const { workspace: slug } = await params
  const session = await auth()
  const workspace = await db.workspace.findUnique({ where: { slug } })
  if (!workspace) notFound()

  const membership = session?.user?.id
    ? await db.workspaceMember.findUnique({ where: { workspaceId_userId: { workspaceId: workspace.id, userId: session.user.id } } })
    : null
  if (!membership) notFound()

  const cpId = membership.role === "CP" ? await resolveCpId(workspace.id, session!.user!.id) : null
  const isAdmin = membership.role === "OWNER" || membership.role === "ADMIN"

  const [cps, commissions, deals] = await Promise.all([
    listChannelPartners(workspace.id),
    listCommissions({ workspaceId: workspace.id, role: membership.role, cpId }),
    listBookings({ workspaceId: workspace.id, role: membership.role, cpId }),
  ])

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Channel Partners</h1>
          <p className="text-sm text-muted-foreground">{cps.length} partners · {commissions.length} commissions</p>
        </div>
        {isAdmin ? <CpToolbar workspaceId={workspace.id} cps={cps} deals={deals.map((d) => ({ id: d.id, title: d.title }))} /> : null}
      </div>

      {isAdmin ? (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold">Partners</h2>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>RERA</TableHead>
                <TableHead>Brokerage</TableHead>
                <TableHead>Deals</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {cps.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-sm text-muted-foreground">
                    No channel partners yet.
                  </TableCell>
                </TableRow>
              ) : (
                cps.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">{c.name}</TableCell>
                    <TableCell>{c.reraNo ?? "—"}</TableCell>
                    <TableCell>{c.brokerage != null ? `${c.brokerage}%` : "—"}</TableCell>
                    <TableCell>{c._count.deals}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </section>
      ) : null}

      <section className="space-y-2">
        <h2 className="text-sm font-semibold">Commissions</h2>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Deal</TableHead>
              <TableHead>Partner</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {commissions.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-sm text-muted-foreground">
                  No commissions yet.
                </TableCell>
              </TableRow>
            ) : (
              commissions.map((cr) => (
                <TableRow key={cr.id}>
                  <TableCell>{cr.deal?.title ?? "—"}</TableCell>
                  <TableCell>{cr.cp?.name ?? "—"}</TableCell>
                  <TableCell>{inr(cr.amount)}</TableCell>
                  <TableCell>
                    <Badge variant={cr.status === "PAID" ? "default" : "secondary"}>{cr.status}</Badge>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </section>
    </div>
  )
}
