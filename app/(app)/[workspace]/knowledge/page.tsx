import { notFound } from "next/navigation"
import { db } from "@/lib/db"
import { auth } from "@/lib/auth"
import { canManageData, canWriteCorpus, resolveViewerScope } from "@/lib/permissions"
import { listDocuments } from "@/modules/rag/ingest"
import type { KnowledgeDocument } from "@/lib/actions/knowledge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { PageHeader } from "@/components/shell/page-header"
import { BookOpen, Library } from "lucide-react"
import { AskPanel } from "@/components/knowledge/ask-panel"
import { DocumentManager } from "@/components/knowledge/document-manager"

/**
 * The knowledge base: ask questions of the workspace's own documents.
 *
 * This is the product surface for `modules/rag`, which until now was reachable
 * only over `/api/v1/tenants/[tenantId]/rag/*` with a workspace API key. The
 * pipeline itself — hybrid retrieval, reranking, the confidence and faithfulness
 * gates, the provider pool — was already built and tested; none of it was
 * reachable by a person at the company.
 *
 * Deliberately a separate route from `/ai`. `/ai` answers from *CRM rows* through
 * `askPipeline`, which is a structured query over deals and payments. This answers
 * from *documents*. They share a question-shaped interface and nothing else, and
 * merging them would make it ambiguous which corpus an answer came from — which is
 * the one fact a user needs in order to trust it.
 */

export default async function KnowledgePage({
  params,
  searchParams,
}: {
  params: Promise<{ workspace: string }>
  searchParams: Promise<{ q?: string }>
}) {
  const { workspace: slug } = await params
  const { q } = await searchParams

  const ws = await db.workspace.findUnique({ where: { slug }, select: { id: true } })
  if (!ws) notFound()

  const session = await auth()
  const scope = session?.user?.id ? await resolveViewerScope(ws.id, session.user.id) : null
  /* Same gate every other page in this app uses, and the reason it is not a
     redirect: a non-member who guesses a valid workspace slug must not learn that
     the slug exists. */
  if (!scope) notFound()

  const docs = await listDocuments({ tenantId: ws.id })

  const documents: KnowledgeDocument[] = docs.map((d) => ({
    id: d.id,
    title: d.title,
    status: d.status,
    modality: d.modality,
    lang: d.lang,
    chunkCount: d.chunkCount,
    department: d.department,
    docType: d.docType,
    confidential: d.confidential,
    error: d.error,
    createdAt: d.createdAt,
  }))

  const searchable = documents.filter((d) => d.status === "READY").length

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={
          <>
            <Library className="size-6 text-brand" /> Knowledge base
          </>
        }
        description="Answers drawn only from your own documents, with the source for every claim."
      />

      <Tabs defaultValue="ask">
        <TabsList>
          <TabsTrigger value="ask">Ask</TabsTrigger>
          <TabsTrigger value="documents">
            Documents
            <span className="ml-1.5 text-xs tabular-nums text-muted-foreground">
              {searchable}/{documents.length}
            </span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="ask" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <BookOpen className="size-4 text-brand" /> Ask your documents
              </CardTitle>
              <CardDescription>
                Grounded in {searchable} searchable document{searchable === 1 ? "" : "s"}.
                If the sources do not support an answer, it says so rather than guessing.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <AskPanel slug={slug} query={q ?? ""} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="documents" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Documents</CardTitle>
              <CardDescription>
                Everything here is visible to everyone in the workspace unless it is
                marked restricted.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <DocumentManager
                slug={slug}
                docs={documents}
                canUpload={canWriteCorpus(scope.role)}
                canDelete={canManageData(scope.role)}
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
