"use client"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"

type Doc = {
  id: string
  renderedHtml: string
  createdAt: Date | string
  template: { kind: string; name: string } | null
}

export function GeneratedDocList({ slug, docs }: { slug: string; docs: Doc[] }) {
  if (docs.length === 0) {
    return <p className="text-sm text-muted-foreground">No documents generated yet. Confirm a booking to produce demand letter #1.</p>
  }
  return (
    <div className="grid gap-3 md:grid-cols-2">
      {docs.map((d) => (
        <DocCard key={d.id} slug={slug} doc={d} />
      ))}
    </div>
  )
}

function DocCard({ slug, doc }: { slug: string; doc: Doc }) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm font-medium">{doc.template?.name ?? "Document"}</div>
          <div className="text-xs text-muted-foreground">
            {doc.template?.kind ?? "—"} · {new Date(doc.createdAt).toLocaleDateString("en-IN")}
          </div>
        </div>
      </div>
      <div className="mt-3 flex gap-2">
        <Dialog>
          <DialogTrigger
            render={
              <Button size="sm" variant="outline">
                View
              </Button>
            }
          />
          <DialogContent className="max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{doc.template?.name ?? "Document"}</DialogTitle>
            </DialogHeader>
            <div className="prose prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: doc.renderedHtml }} />
          </DialogContent>
        </Dialog>
        <Button size="sm" render={<a href={`/${slug}/documents/${doc.id}/pdf`} download />}>
          Download PDF
        </Button>
      </div>
    </div>
  )
}
