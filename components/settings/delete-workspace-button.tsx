"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { LoaderCircle, Trash2 } from "lucide-react"

import { deleteWorkspaceAction } from "@/lib/actions/settings"
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
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Input } from "@/components/ui/input"

export function DeleteWorkspaceButton({
  workspaceId,
  workspaceName,
}: {
  workspaceId: string
  workspaceName: string
}) {
  const router = useRouter()
  const [confirm, setConfirm] = useState("")
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()

  const matches = confirm.trim() === workspaceName

  function onDelete() {
    if (!matches) return
    startTransition(async () => {
      const result = await deleteWorkspaceAction(workspaceId)
      if (result.error) {
        toast.error(result.error.message)
        return
      }
      toast.success("Workspace deleted")
      router.push("/login")
      router.refresh()
    })
  }

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger
        render={
          <Button variant="destructive" size="sm">
            <Trash2 data-icon="inline-start" />
            Delete workspace
          </Button>
        }
      />
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete this workspace?</AlertDialogTitle>
          <AlertDialogDescription>
            This permanently deletes <span className="font-semibold">{workspaceName}</span>{" "}
            and all of its contacts, deals, organizations, and activity. Type the
            workspace name to confirm.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <Input
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          placeholder={workspaceName}
          className="mt-2"
        />
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            disabled={!matches || isPending}
            onClick={onDelete}
            className="bg-destructive text-white hover:bg-destructive/90"
          >
            {isPending && (
              <LoaderCircle data-icon="inline-start" className="animate-spin" />
            )}
            Delete permanently
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
