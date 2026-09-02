import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { listBrokers, listCommissions, resolveBrokerId } from "@/modules/brokers/queries"
import { listBookings } from "@/modules/booking/queries"
import { BrokerToolbar } from "@/components/channel-partners/cp-panel"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"

export const metadata: Metadata = { title: "Brokers" }

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

  const brokerId = membership.role === "BROKER" ? await resolveBrokerId(workspace.id, session!.user!.id) : null
  const isAdmin = membership.role === "OWNER" || membership.role === "ADMIN"

  const [cps, commissions, deals] = await Promise.all([
    listBrokers(workspace.id),
    listCommissions({ workspaceId: workspace.id, role: membership.role, brokerId }),
    listBookings({ workspaceId: workspace.id, role: membership.role, brokerId }),
  ])

  return (
    <div className="space-y-6">
      <div className="rounded-[20px] border bg-card p-5 md:p-6 relative overflow-hidden">
        <div aria-hidden className="pointer-events-none absolute inset-0">
          <div className="absolute -top-16 -right-16 h-48 w-64 rounded-full bg-gradient-to-br from-amber-500/10 via-orange-500/10 to-violet-500/10 blur-2xl" />
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-amber-500/20 to-transparent" />
        </div>
        <div className="relative flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-[22px] font-semibold tracking-tight">Brokers</h1>
            <p className="mt-1 text-sm text-muted-foreground">{cps.length} partners · {commissions.length} commissions · CP scope via brokerScopeFilter</p>
          </div>
          {isAdmin ? <BrokerToolbar workspaceId={workspace.id} cps={cps} deals={deals.map((d: { id: string; title: string }) => ({ id: d.id, title: d.title }))} /> : null}
        </div>
      </div>

      {isAdmin ? (
        <section className="rounded-xl border bg-card p-4 space-y-3">
          <h2 className="text-sm font-semibold">Partners <span className="text-muted-foreground font-normal">· {cps.length}</span></h2>
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
                    No brokers yet.
                  </TableCell>
                </TableRow>
              ) : (
                cps.map((c: (typeof cps)[number]) => (
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

      <section className="rounded-xl border bg-card p-4 space-y-3">
        <h2 className="text-sm font-semibold">Commissions <span className="text-muted-foreground font-normal">· {commissions.length}</span></h2>
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
              commissions.map((cr: (typeof commissions)[number]) => (
                <TableRow key={cr.id}>
                  <TableCell>{cr.deal?.title ?? "—"}</TableCell>
                  <TableCell>{cr.broker?.name ?? "—"}</TableCell>
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
