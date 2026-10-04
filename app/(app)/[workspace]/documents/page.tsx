import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { db } from "@/lib/db"
import { auth } from "@/lib/auth"
import { resolveViewerScope } from "@/lib/permissions"
import { listTemplates, listGeneratedDocuments } from "@/modules/documents/queries"
import { GeneratedDocList } from "@/components/documents/doc-list"
import { Badge } from "@/components/ui/badge"
import { PageHeader } from "@/components/shell/page-header"

export const metadata: Metadata = { title: "Documents" }

export default async function DocumentsPage({ params }: { params: Promise<{ workspace: string }> }) {
  const { workspace: slug } = await params
  const ws = await db.workspace.findUnique({ where: { slug } })
  if (!ws) notFound()

  const session = await auth()
  const scope = session?.user?.id ? await resolveViewerScope(ws.id, session.user.id) : null
  if (!scope) notFound()

  const [templates, docs] = await Promise.all([
    listTemplates(ws.id),
    listGeneratedDocuments(scope),
  ])

  return (
    <div className="space-y-6">
      <PageHeader
        title="Documents"
        description="RERA-aligned demand / allotment / receipt / possession letters with PDF download."
      />

      <section className="rounded-md border bg-card p-4 space-y-3">
        <h2 className="text-sm font-semibold flex items-center gap-2">Templates <Badge variant="outline" className="rounded-full">{templates.length}</Badge></h2>
        {templates.length === 0 ? (
          <p className="rounded-md border border-dashed bg-muted/20 px-4 py-6 text-center text-sm text-muted-foreground">No templates yet — create demand/allotment/receipt/possession with shortcodes.</p>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {templates.map((t) => (
              <div key={t.id} className="group rounded-md border bg-muted/20 px-3.5 py-3 hover:bg-card hover:shadow-sm hover:border-brand/30 transition-colors">
                <div className="flex items-center justify-between gap-2"><span className="text-sm font-medium">{t.name}</span><Badge variant="secondary" className="rounded-full text-[11px]">{t.kind}</Badge></div>
                {t.reraAligned ? <Badge className="mt-2 rounded-full">RERA</Badge> : null}
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="rounded-md border bg-card p-4 space-y-3">
        <h2 className="text-sm font-semibold">Generated documents <span className="text-muted-foreground font-normal">· {docs.length}</span></h2>
        <GeneratedDocList slug={slug} docs={docs} />
      </section>
    </div>
  )
}
