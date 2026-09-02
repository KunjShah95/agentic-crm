import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { db } from "@/lib/db"
import { listTemplates, listGeneratedDocuments } from "@/modules/documents/queries"
import { GeneratedDocList } from "@/components/documents/doc-list"
import { Badge } from "@/components/ui/badge"

export const metadata: Metadata = { title: "Documents" }

export default async function DocumentsPage({ params }: { params: Promise<{ workspace: string }> }) {
  const { workspace: slug } = await params
  const ws = await db.workspace.findUnique({ where: { slug } })
  if (!ws) notFound()

  const [templates, docs] = await Promise.all([listTemplates(ws.id), listGeneratedDocuments(ws.id)])

  return (
    <div className="flex flex-col gap-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Documents</h1>
        <p className="text-sm text-muted-foreground">
          RERA-aligned demand / allotment / receipt / possession letters + e-sign.
        </p>
      </div>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold">Templates</h2>
        {templates.length === 0 ? (
          <p className="text-sm text-muted-foreground">No templates yet.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {templates.map((t) => (
              <div key={t.id} className="rounded-lg border bg-card px-3 py-2 text-sm">
                <span className="font-medium">{t.name}</span>{" "}
                <Badge variant="secondary" className="ml-1">
                  {t.kind}
                </Badge>
                {t.reraAligned ? <Badge className="ml-1">RERA</Badge> : null}
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold">Generated</h2>
        <GeneratedDocList workspaceId={ws.id} docs={docs} />
      </section>
    </div>
  )
}
