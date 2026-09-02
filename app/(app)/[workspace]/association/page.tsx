import { notFound } from "next/navigation"
import { db } from "@/lib/db"
import { auth } from "@/lib/auth"
import { listAssociationMembers, listPooledLeads, listReferrals } from "@/modules/association/queries"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Building2, Users, Handshake, Share2 } from "lucide-react"
import Link from "next/link"

export default async function AssociationPage({ params }: { params: Promise<{ workspace: string }> }) {
  const { workspace: slug } = await params
  const ws = await db.workspace.findUnique({ where: { slug } })
  if (!ws) notFound()
  const session = await auth()
  const membership = session?.user?.id ? await db.workspaceMember.findFirst({ where: { workspaceId: ws.id, userId: session.user.id } }) : null
  const assocMember = await db.associationMember.findFirst({ where: { workspaceId: ws.id }, include: { association: true } })
  const association = assocMember?.association ?? null

  if (!association) {
    // show all associations to join
    const all = await db.association.findMany({ take: 10, orderBy: { createdAt: "desc" } })
    return (
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">NAAR Association <Badge variant="secondary">P0 moat</Badge></h1>
          <p className="text-sm text-muted-foreground">No association joined yet. Join NAAR to enable shared lead pool + inventory exchange + referral ledger. Every query association-scoped.</p>
        </div>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Available associations</CardTitle>
            <CardDescription>Join to pool a lead → other members claim → both see audit; your units visible in association grid.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {all.length === 0 ? <p className="text-sm text-muted-foreground">No associations seeded. Create one via <span className="font-mono">createAssociation</span>.</p> : all.map((a) => (
              <div key={a.id} className="flex items-center justify-between rounded-lg border px-3 py-2">
                <div><div className="font-medium">{a.name}</div><div className="text-xs text-muted-foreground">{a.slug} · {a.city}</div></div>
                <Badge variant="outline">{a.slug}</Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    )
  }

  const [members, pooled, referrals, listings] = await Promise.all([
    listAssociationMembers(association.id),
    listPooledLeads(association.id, "POOLED"),
    listReferrals(association.id),
    db.associationListing.findMany({ where: { associationId: association.id }, include: { unit: true, listedBy: { select: { name: true } } } }),
  ])

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
            {association.name} <Badge className="rounded-full">{association.slug}</Badge>
          </h1>
          <p className="text-sm text-muted-foreground">Member directory · Shared lead pool · Inventory exchange · Referral ledger — all association-scoped. Network effects: the moat.</p>
        </div>
        <Badge variant="secondary" className="rounded-full gap-1.5"><Users className="size-3" /> {members.length} members</Badge>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2"><Users className="size-4" /> Directory</CardTitle>
            <CardDescription>{members.length} workspaces in {association.name}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {members.map((m) => (
              <div key={m.id} className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm">
                <span className="font-medium">{m.workspace.name}</span><Badge variant={m.workspaceId === ws.id ? "default" : "secondary"}>{m.role}</Badge>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2"><Share2 className="size-4" /> Shared lead pool</CardTitle>
            <CardDescription>Builder can&apos;t service → pool → other members claim (audit + consent preserved)</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {pooled.length === 0 ? <p className="text-sm text-muted-foreground">No pooled leads. Pool via <span className="font-mono">poolLead</span>.</p> : pooled.slice(0, 5).map((p) => (
              <div key={p.id} className="rounded-lg border px-3 py-2 text-sm">
                <div className="font-medium">{p.contact.firstName} {p.contact.lastName} <Badge variant="outline" className="ml-1">{p.contact.leadSource ?? "UNKNOWN"}</Badge></div>
                <div className="text-xs text-muted-foreground">pooled by {p.pooledBy.name} · {p.status}</div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2"><Building2 className="size-4" /> Inventory exchange</CardTitle>
            <CardDescription>Members list Units to shared grid — CP/other builders view allocated inventory (reuse brokerScope at association level)</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {listings.length === 0 ? <p className="text-sm text-muted-foreground">No listings. List via <span className="font-mono">listUnitToAssociation</span>.</p> : listings.slice(0, 5).map((l) => (
              <div key={l.id} className="rounded-lg border px-3 py-2 text-sm flex justify-between"><span>{l.unit.unitNo} · {l.unit.config}</span><span className="text-xs text-muted-foreground">{l.listedBy.name}</span></div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2"><Handshake className="size-4" /> Referral ledger</CardTitle>
          <CardDescription>Cross-member referral → CommissionRule split. Acceptance: builder A pools → B claims → both see audit; A&apos;s units visible in association grid.</CardDescription>
        </CardHeader>
        <CardContent>
          {referrals.length === 0 ? <p className="text-sm text-muted-foreground">No referrals yet. Create via <span className="font-mono">createReferral</span>.</p> : (
            <div className="space-y-2">
              {referrals.slice(0, 5).map((r) => (
                <div key={r.id} className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm">
                  <span>{r.fromWorkspace.name} → {r.toWorkspace.name} · {r.contact.firstName} {r.contact.lastName}</span><Badge variant="secondary">{r.status}</Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
