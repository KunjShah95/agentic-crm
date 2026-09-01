import Link from "next/link"
import { notFound } from "next/navigation"
import { db } from "@/lib/db"
import { listProjects } from "@/modules/property/queries"

export default async function ProjectsPage({
  params,
}: {
  params: Promise<{ workspace: string }>
}) {
  const { workspace: slug } = await params
  const ws = await db.workspace.findUnique({ where: { slug } })
  if (!ws) notFound()

  const projects = await listProjects(ws.id)

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-2xl font-semibold">Projects</h1>
      {projects.length === 0 ? (
        <p className="text-sm text-muted-foreground">No projects yet.</p>
      ) : null}
      <div className="grid md:grid-cols-3 gap-4">
        {projects.map((p) => (
          <Link
            key={p.id}
            href={`/${slug}/projects/${p.id}`}
            className="border rounded-lg p-4 hover:shadow bg-card"
          >
            <div className="font-medium">{p.name}</div>
            <div className="text-xs text-muted-foreground">
              {p.reraNo ?? "RERA TBD"} · {(p as unknown as { _count: { units: number } })._count.units} units
            </div>
            <div className="text-xs text-muted-foreground">{p.city}</div>
          </Link>
        ))}
      </div>
    </div>
  )
}
