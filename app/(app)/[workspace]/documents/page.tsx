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
    <div className="space-y-6">
      <div className="rounded-[20px] border bg-card p-5 md:p-6 relative overflow-hidden">
        <div aria-hidden className="pointer-events-none absolute inset-0">
          <div className="absolute -top-16 -right-16 h-48 w-64 rounded-full bg-gradient-to-br from-blue-500/10 via-violet-500/10 to-cyan-500/10 blur-2xl" />
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-blue-500/20 to-transparent" />
        </div>
        <div className="relative">
          <h1 className="text-[22px] font-semibold tracking-tight">Documents</h1>
          <p className="mt-1 text-sm text-muted-foreground">RERA-aligned demand / allotment / receipt / possession letters + e-sign stub.</p>
        </div>
      </div>

      <section className="rounded-xl border bg-card p-4 space-y-3">
        <h2 className="text-sm font-semibold flex items-center gap-2">Templates <Badge variant="outline" className="rounded-full">{templates.length}</Badge></h2>
        {templates.length === 0 ? (
          <p className="rounded-lg border border-dashed bg-muted/20 px-4 py-6 text-center text-sm text-muted-foreground">No templates yet — create demand/allotment/receipt/possession with shortcodes.</p>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {templates.map((t) => (
              <div key={t.id} className="group rounded-xl border bg-muted/20 px-3.5 py-3 hover:bg-card hover:shadow-sm hover:border-violet-200 transition-colors">
                <div className="flex items-center justify-between gap-2"><span className="text-sm font-medium">{t.name}</span><Badge variant="secondary" className="rounded-full font-mono text-[11px]">{t.kind}</Badge></div>
                {t.reraAligned ? <Badge className="mt-2 rounded-full">RERA</Badge> : null}
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="rounded-xl border bg-card p-4 space-y-3">
        <h2 className="text-sm font-semibold">Generated documents <span className="text-muted-foreground font-normal">· {docs.length}</span></h2>
        <GeneratedDocList workspaceId={ws.id} docs={docs} />
      </section>
    </div>
  )
}
