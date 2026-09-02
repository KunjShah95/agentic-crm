import Link from "next/link"
import { notFound } from "next/navigation"
import { db } from "@/lib/db"
import { listProjects } from "@/modules/property/queries"
import { PageHeader, Stat } from "@/components/shell/page-header"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Building2, MapPin, Layers, Sparkles, ArrowRight } from "lucide-react"

export default async function ProjectsPage({
  params,
}: {
  params: Promise<{ workspace: string }>
}) {
  const { workspace: slug } = await params
  const ws = await db.workspace.findUnique({ where: { slug } })
  if (!ws) notFound()

  const projects = await listProjects(ws.id)
  const totalUnits = projects.reduce((s, p) => s + (p as unknown as { _count: { units: number } })._count.units, 0)

  return (
    <div className="space-y-6">
      <PageHeader
        title="Projects"
        description={`${projects.length} projects · ${totalUnits} units · RERA-aligned, workspace-scoped`}
        badge={<Badge variant="secondary" className="rounded-full gap-1.5"><Building2 className="size-3" /> Inventory core</Badge>}
        stats={
          <>
            <Stat label="Projects" value={projects.length} sub="Active in workspace" icon={<Building2 className="size-3" />} />
            <Stat label="Units" value={totalUnits} sub="AVAILABLE / HOLD / BOOKED / SOLD" icon={<Layers className="size-3" />} />
            <Stat label="Cities" value={new Set(projects.map((p) => p.city)).size || 1} sub="Ahmedabad-first" icon={<MapPin className="size-3" />} />
            <Stat label="RERA" value={`${projects.filter((p) => p.reraNo).length}/${projects.length}`} sub="With RERA no." icon={<Sparkles className="size-3" />} />
          </>
        }
      />

      {projects.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-12 text-center">
            <div className="mx-auto flex size-12 items-center justify-center rounded-xl bg-muted"><Building2 className="size-6 text-muted-foreground" /></div>
            <div className="mt-3 text-sm font-medium">No projects yet</div>
            <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">Create your first project → add towers & units → generate cost sheet in &lt;30s.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {projects.map((p) => (
            <Link
              key={p.id}
              href={`/${slug}/projects/${p.id}`}
              className="group relative overflow-hidden rounded-[16px] border bg-card p-5 hover:shadow-[0_16px_40px_rgba(0,0,0,0.08)] hover:-translate-y-0.5 hover:border-violet-200 dark:hover:border-violet-800 transition-all"
            >
              <div className="pointer-events-none absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity bg-[radial-gradient(400px_circle_at_80%_0%,rgba(139,92,246,0.08),transparent_70%)]" />
              <div className="relative flex items-start justify-between gap-3">
                <span className="flex size-9 items-center justify-center rounded-xl bg-foreground text-background text-xs font-bold">
                  {p.name.slice(0, 2).toUpperCase()}
                </span>
                <Badge variant="outline" className="rounded-full font-mono text-[11px]">{p.city}</Badge>
              </div>
              <div className="relative mt-3 font-medium tracking-tight">{p.name}</div>
              <div className="relative mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                <Sparkles className="size-3" /> {p.reraNo ?? "RERA TBD"} · {(p as unknown as { _count: { units: number } })._count.units} units
              </div>
              <div className="relative mt-4 flex items-center gap-1.5 text-xs font-medium text-violet-600 dark:text-violet-400">
                Open inventory <ArrowRight className="size-3 group-hover:translate-x-0.5 transition-transform" />
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
