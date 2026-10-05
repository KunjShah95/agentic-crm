"use client"

import { useActionState, useState, useTransition } from "react"
import { toast } from "sonner"
import { deleteKnowledgeDocumentAction, uploadKnowledgeDocumentAction, type UploadSummary } from "@/lib/actions/knowledge"
import type { Result } from "@/lib/actions"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Spinner } from "@/components/ui/spinner"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  TriangleAlert,
  Upload,
  FileText,
  Lock,
  Trash2,
  CheckCircle2,
  Clock,
  CircleX,
} from "lucide-react"
import type { KnowledgeDocument } from "@/lib/actions/knowledge"

/**
 * Add and remove corpus documents.
 *
 * Status is shown per document rather than as one summary, because the states mean
 * genuinely different things to the person waiting: `PROCESSING` becomes
 * searchable on its own once the embedding worker runs, `READY` is searchable now,
 * and `ERROR` never will unless someone re-adds it. A single "N documents added"
 * toast collapses the only one of those the user can act on.
 */

/** Mirrors the engine's status enum without importing it into a client bundle. */
function StatusCell({ doc }: { doc: KnowledgeDocument }) {
  if (doc.status === "READY") {
    return (
      <Badge variant="secondary" className="gap-1">
        <CheckCircle2 className="size-3" /> Searchable
      </Badge>
    )
  }
  if (doc.status === "PROCESSING") {
    return (
      <Badge variant="outline" className="gap-1">
        <Clock className="size-3" /> Indexing
      </Badge>
    )
  }
  return (
    <Badge variant="destructive" className="gap-1">
      <CircleX className="size-3" /> Failed
    </Badge>
  )
}

function UploadForm({ slug }: { slug: string }) {
  const [state, formAction, isPending] = useActionState<Result<UploadSummary> | null, FormData>(
    uploadKnowledgeDocumentAction.bind(null, slug),
    null
  )

  return (
    <form action={formAction} className="space-y-3">
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-60 flex-1 space-y-1.5">
          <Label htmlFor="kb-files">Documents</Label>
          <Input id="kb-files" name="files" type="file" multiple required className="h-9" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="kb-department">Department</Label>
          <select
            id="kb-department"
            name="department"
            defaultValue="general"
            className="h-9 rounded-md border bg-card px-2 text-sm"
          >
            {["general", "legal", "finance", "sales", "marketing", "support", "hr", "engineering"].map(
              (d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              )
            )}
          </select>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Checkbox id="kb-confidential" name="confidential" />
        <Label htmlFor="kb-confidential" className="text-xs font-normal text-muted-foreground">
          Restrict to admins and owners
        </Label>
      </div>

      <Button type="submit" variant="brand" className="rounded-sm" disabled={isPending}>
        {isPending ? <Spinner className="size-4" /> : <Upload className="size-4" />}
        {isPending ? "Adding" : "Add to knowledge base"}
      </Button>

      {state && "error" in state && state.error ? (
        <Alert variant="destructive">
          <TriangleAlert className="size-4" />
          <AlertTitle>Nothing was added</AlertTitle>
          <AlertDescription>{state.error.message}</AlertDescription>
        </Alert>
      ) : null}

      {state && "uploaded" in state && state.data ? (
        <Alert>
          <TriangleAlert className="size-4" />
          <AlertTitle>
            {state.data.uploaded} added
            {state.data.skipped > 0 ? `, ${state.data.skipped} already here` : ""}
          </AlertTitle>
          <AlertDescription>
            {state.data.failed.length > 0 ? (
              <ul className="list-disc pl-4">
                {state.data.failed.map((f) => (
                  <li key={f}>{f}</li>
                ))}
              </ul>
            ) : (
              "Indexing runs in the background — a document becomes searchable once it says so below."
            )}
          </AlertDescription>
        </Alert>
      ) : null}
    </form>
  )
}

function DocumentTable({
  slug,
  docs,
  canDelete,
}: {
  slug: string
  docs: KnowledgeDocument[]
  canDelete: boolean
}) {
  const [pendingId, setPendingId] = useState<string | null>(null)
  const [, startTransition] = useTransition()

  const remove = (id: string, title: string | null) => {
    // Held per-id for the same reason the tag manager does it per-id: a global
    // flag would make one slow delete look like the whole table had hung.
    setPendingId(id)
    startTransition(async () => {
      const result = await deleteKnowledgeDocumentAction(slug, id)
      setPendingId(null)
      if (result.error) toast.error(result.error.message)
      else toast.success(`Removed ${title ?? "document"}`)
    })
  }

  if (docs.length === 0) {
    return (
      <p className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
        No documents yet. Add a RERA registration, an approved pricing note, or a
        policy PDF — answers are drawn only from what is here.
      </p>
    )
  }

  return (
    <div className="overflow-hidden rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Document</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Department</TableHead>
            <TableHead className="text-right">Chunks</TableHead>
            {canDelete ? <TableHead className="w-10" /> : null}
          </TableRow>
        </TableHeader>
        <TableBody>
          {docs.map((doc) => (
            <TableRow key={doc.id}>
              <TableCell>
                <div className="flex items-center gap-2">
                  <FileText className="size-4 shrink-0 text-muted-foreground" />
                  <div className="min-w-0">
                    <div className="truncate font-medium">{doc.title ?? "Untitled"}</div>
                    {doc.error ? (
                      <div className="truncate text-xs text-destructive">{doc.error}</div>
                    ) : null}
                  </div>
                  {doc.confidential ? (
                    <Lock className="size-3 shrink-0 text-muted-foreground" aria-label="Restricted" />
                  ) : null}
                </div>
              </TableCell>
              <TableCell>
                <StatusCell doc={doc} />
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">
                {doc.department ?? "—"}
              </TableCell>
              <TableCell className="text-right text-sm tabular-nums text-muted-foreground">
                {doc.chunkCount ?? 0}
              </TableCell>
              {canDelete ? (
                <TableCell>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="size-8 p-0 text-muted-foreground hover:text-destructive"
                    disabled={pendingId === doc.id}
                    aria-busy={pendingId === doc.id}
                    onClick={() => remove(doc.id, doc.title)}
                  >
                    {pendingId === doc.id ? (
                      <Spinner className="size-3.5" />
                    ) : (
                      <Trash2 className="size-3.5" />
                    )}
                    <span className="sr-only">Remove {doc.title ?? "document"}</span>
                  </Button>
                </TableCell>
              ) : null}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

/**
 * Upload and delete are gated separately, and the copy says which is which.
 *
 * They used to share one `canEdit` flag, which meant a MEMBER — who may add
 * documents — was also shown a delete button the action then refused, and the
 * only sign was a 403 toast after the click. Showing the control only to someone
 * who can use it is the point of rendering permissions at all.
 */
export function DocumentManager({
  slug,
  docs,
  canUpload,
  canDelete,
}: {
  slug: string
  docs: KnowledgeDocument[]
  canUpload: boolean
  canDelete: boolean
}) {
  return (
    <div className="space-y-4">
      {canUpload ? (
        <UploadForm slug={slug} />
      ) : (
        <p className="text-sm text-muted-foreground">
          Your role can read the knowledge base. Ask a member, admin or owner to add
          documents.
        </p>
      )}
      <DocumentTable slug={slug} docs={docs} canDelete={canDelete} />
    </div>
  )
}
