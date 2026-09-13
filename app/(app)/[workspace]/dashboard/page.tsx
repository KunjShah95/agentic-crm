import type { Metadata } from "next"
import { notFound } from "next/navigation"
import Link from "next/link"
import { db } from "@/lib/db"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Users, KanbanSquare, Building2, CalendarCheck, ArrowRight } from "lucide-react"

export const metadata: Metadata = { title: "Dashboard" }

export default async function DashboardPage({ params }: { params: Promise<{ workspace: string }> }) {
  const { workspace: slug } = await params
  const ws = await db.workspace.findUnique({ where: { slug } })
  if (!ws) notFound()

  const [contacts, deals, projects, siteVisits, organizations, recentDeals, recentActivities] = await Promise.all([
    db.contact.count({ where: { workspaceId: ws.id } }),
    db.deal.count({ where: { workspaceId: ws.id } }),
    db.project.count({ where: { workspaceId: ws.id } }),
    db.siteVisit.count({ where: { workspaceId: ws.id } }),
    db.organization.count({ where: { workspaceId: ws.id } }),
    db.deal.findMany({
      where: { workspaceId: ws.id },
      orderBy: { updatedAt: "desc" },
      take: 5,
      include: { stage: { select: { name: true } } },
    }),
    db.activity.findMany({
      where: { workspaceId: ws.id },
      orderBy: { createdAt: "desc" },
      take: 6,
      select: { id: true, type: true, body: true, createdAt: true },
    }),
  ])

  const stats = [
    { label: "Contacts", value: contacts, icon: Users, href: `/${slug}/contacts` },
    { label: "Deals", value: deals, icon: KanbanSquare, href: `/${slug}/deals` },
    { label: "Projects", value: projects, icon: Building2, href: `/${slug}/projects` },
    { label: "Site visits", value: siteVisits, icon: CalendarCheck, href: `/${slug}/site-visits` },
    { label: "Organizations", value: organizations, icon: Building2, href: `/${slug}/organizations` },
  ]

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-display font-semibold tracking-tight">
            Dashboard <Badge variant="secondary" className="rounded-md font-mono text-xs">{ws.name}</Badge>
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">A live overview of contacts, deals, projects, and site visits for this workspace.</p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" className="rounded-full gap-1.5" render={<Link href={`/${slug}/contacts`} />}>
            Go to contacts <ArrowRight className="size-3.5" />
          </Button>
          <Button variant="outline" size="sm" className="rounded-full" render={<Link href={`/${slug}/reports`} />}>
            Reports
          </Button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {stats.map((s) => (
          <Link key={s.label} href={s.href}>
            <Card className="hover:border-foreground/20 transition-colors">
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <s.icon className="size-4" />
                  <span className="font-mono text-[11px] tracking-[0.12em]">{s.label.toUpperCase()}</span>
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-semibold tracking-tight tabular-nums">{s.value}</div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recent deals</CardTitle>
            <CardDescription>Last updated first.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {recentDeals.length === 0 && <p className="text-sm text-muted-foreground">No deals yet.</p>}
            {recentDeals.map((d) => (
              <Link key={d.id} href={`/${slug}/deals/${d.id}`} className="flex items-center gap-3 rounded-xl border px-3 py-2.5 hover:bg-muted/50 transition-colors">
                <span className="text-sm font-medium truncate">{d.title}</span>
                <Badge variant="secondary" className="ml-auto rounded-full font-mono text-[10px] shrink-0">{d.stage.name}</Badge>
              </Link>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recent activity</CardTitle>
            <CardDescription>Across contacts and deals.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {recentActivities.length === 0 && <p className="text-sm text-muted-foreground">No activity yet.</p>}
            {recentActivities.map((a) => (
              <div key={a.id} className="flex items-center gap-3 rounded-xl border bg-muted/40 px-3 py-2.5">
                <Badge variant="outline" className="rounded-full font-mono text-[10px] shrink-0">{a.type}</Badge>
                <span className="text-xs text-muted-foreground truncate">{a.body || a.type}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
