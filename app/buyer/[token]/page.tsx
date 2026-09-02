import { notFound } from "next/navigation"
import { getBuyerPortal } from "@/modules/buyerPortal/actions"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Building2, Wallet, FileText } from "lucide-react"

export default async function BuyerPortalPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const data = await getBuyerPortal(token)
  if (!data) notFound()
  const { access, deals, docs } = data
  const contact = access.contact
  return (
    <div className="mx-auto max-w-4xl p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Buyer Portal — {contact.firstName} {contact.lastName}</h1>
        <p className="text-sm text-muted-foreground">Magic link · expires {access.expiresAt.toLocaleDateString("en-IN")} · {access.workspace.name}</p>
      </div>
      <div className="grid md:grid-cols-2 gap-4">
        {deals.map((d) => (
          <Card key={d.id}>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2"><Building2 className="size-4" /> {d.title}</CardTitle>
              <CardDescription>{d.bookingStage ?? "INQUIRY"} · {d.unit?.unitNo ?? "no unit"} · ₹{d.value?.toLocaleString("en-IN") ?? "—"}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="text-xs font-mono">Unit {d.unit?.unitNo ?? "—"} · Project {d.unit?.projectId ?? "—"}</div>
              <div className="flex flex-wrap gap-1">
                {d.payments.slice(0, 4).map((p) => (
                  <Badge key={p.id} variant={p.status==="PAID"?"default":p.status==="OVERDUE"?"destructive":"secondary"} className="font-mono text-xs">{p.status} ₹{p.amount.toLocaleString("en-IN")}</Badge>
                ))}
              </div>
              {d.payments.length===0 ? <p className="text-xs text-muted-foreground">No payments yet.</p> : null}
            </CardContent>
          </Card>
        ))}
        {deals.length===0 ? <Card><CardContent className="p-6 text-sm text-muted-foreground">No bookings yet.</CardContent></Card> : null}
      </div>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2"><FileText className="size-4" /> Documents</CardTitle>
          <CardDescription>Demand letters, allotment, receipts — RERA-aligned</CardDescription>
        </CardHeader>
        <CardContent>
          {docs.length===0 ? <p className="text-sm text-muted-foreground">No documents yet.</p> : docs.map((doc: { id: string; templateId: string; createdAt: Date }) => (
            <div key={doc.id} className="rounded-lg border px-3 py-2 text-sm flex justify-between"><span>{doc.templateId}</span><span className="text-xs text-muted-foreground">{new Date(doc.createdAt).toLocaleDateString("en-IN")}</span></div>
          ))}
        </CardContent>
      </Card>
      <p className="text-xs text-muted-foreground">Share this link with the buyer — it expires and logs lastSeenAt for DPDP audit.</p>
    </div>
  )
}
