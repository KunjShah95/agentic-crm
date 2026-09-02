"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { requestESign } from "@/modules/documents/actions"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
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
  eSignStatus: string
  createdAt: Date | string
  template: { kind: string; name: string } | null
}

export function GeneratedDocList({ workspaceId, docs }: { workspaceId: string; docs: Doc[] }) {
  if (docs.length === 0) {
    return <p className="text-sm text-muted-foreground">No documents generated yet. Confirm a booking to produce demand letter #1.</p>
  }
  return (
    <div className="grid gap-3 md:grid-cols-2">
      {docs.map((d) => (
        <DocCard key={d.id} workspaceId={workspaceId} doc={d} />
      ))}
    </div>
  )
}

function DocCard({ workspaceId, doc }: { workspaceId: string; doc: Doc }) {
  const router = useRouter()
  const [pending, start] = useTransition()

  function sign() {
    start(async () => {
      try {
        const r = await requestESign({ workspaceId, generatedDocumentId: doc.id })
        toast.success(r.mock ? "E-sign requested (mock)" : "E-sign requested")
        router.refresh()
      } catch (e) {
        toast.error((e as Error).message)
      }
    })
  }

  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm font-medium">{doc.template?.name ?? "Document"}</div>
          <div className="text-xs text-muted-foreground">
            {doc.template?.kind ?? "—"} · {new Date(doc.createdAt).toLocaleDateString("en-IN")}
          </div>
        </div>
        <Badge variant={doc.eSignStatus === "SIGNED" ? "default" : "secondary"}>{doc.eSignStatus}</Badge>
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
        <Button size="sm" disabled={pending || doc.eSignStatus === "SIGNED"} onClick={sign}>
          Request e-sign
        </Button>
      </div>
    </div>
  )
}
