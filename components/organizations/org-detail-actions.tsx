"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Trash2 } from "lucide-react"

import { deleteOrganizationAction } from "@/lib/actions/organizations"
import { OrgFormDialog } from "@/components/organizations/org-form-dialog"
import { Button } from "@/components/ui/button"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"

export function OrgDetailActions({
  workspaceId,
  workspaceSlug,
  org,
  role,
}: {
  workspaceId: string
  workspaceSlug: string
  org: {
    id: string
    name: string
    domain: string | null
    industry: string | null
    size: string | null
    website: string | null
  }
  role: string
}) {
  const router = useRouter()
  const [deleteOpen, setDeleteOpen] = useState(false)

  async function onDelete() {
    const result = await deleteOrganizationAction(workspaceId, org.id)
    if (result.error) {
      toast.error(result.error.message)
      return
    }
    toast.success("Organization deleted")
    router.push(`/${workspaceSlug}/organizations`)
    router.refresh()
  }

  const canDelete = role === "ADMIN" || role === "OWNER"

  return (
    <div className="flex items-center gap-2">
      <OrgFormDialog
        workspaceId={workspaceId}
        org={org}
        trigger={<Button variant="outline" size="sm">Edit</Button>}
      />
      {canDelete && (
        <Button
          variant="ghost"
          size="sm"
          className="text-destructive hover:text-destructive"
          onClick={() => setDeleteOpen(true)}
        >
          <Trash2 data-icon="inline-start" />
          Delete
        </Button>
      )}

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {org.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              The company profile will be removed and contacts unlinked. This
              can&apos;t be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={onDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
