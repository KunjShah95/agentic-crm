"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { LoaderCircle, Plus, Trash2 } from "lucide-react"

import {
  assignContactTagAction,
  createTagAction,
} from "@/lib/actions/tags"
import { deleteContactAction, setContactOwnerAction } from "@/lib/actions/contacts"
import { ContactFormDialog } from "@/components/contacts/contact-form-dialog"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

const PRESET_COLORS = [
  "#64748b",
  "#ef4444",
  "#f59e0b",
  "#10b981",
  "#3b82f6",
  "#8b5cf6",
  "#ec4899",
]

export function ContactDetailActions({
  workspaceId,
  workspaceSlug,
  contactId,
  members,
  tags,
  currentOwnerId,
  currentTagIds,
  role,
  organizations,
  contact,
}: {
  workspaceId: string
  workspaceSlug: string
  contactId: string
  members: { userId: string; user: { id: string; name: string } }[]
  tags: { id: string; name: string; color: string }[]
  currentOwnerId: string | null
  currentTagIds: string[]
  role: string
  organizations: { id: string; name: string }[]
  contact: {
    id: string
    firstName: string
    lastName: string
    email: string | null
    phone: string | null
    jobTitle: string | null
    linkedinUrl: string | null
    organizationId: string | null
  }
}) {
  const router = useRouter()
  const [tagDialogOpen, setTagDialogOpen] = React.useState(false)
  const [deleteOpen, setDeleteOpen] = React.useState(false)
  const [newTagName, setNewTagName] = React.useState("")
  const [newTagColor, setNewTagColor] = React.useState(PRESET_COLORS[0])
  const [isPending, startTransition] = React.useTransition()

  async function changeOwner(ownerId: string) {
    const result = await setContactOwnerAction(workspaceId, contactId, ownerId)
    if (result.error) toast.error(result.error.message)
    else router.refresh()
  }

  async function assignTag(tagId: string) {
    const result = await assignContactTagAction(workspaceId, contactId, tagId)
    if (result.error) toast.error(result.error.message)
    else {
      toast.success("Tag added")
      router.refresh()
    }
  }

  function createAndAssign(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!newTagName.trim()) return
    startTransition(async () => {
      const created = await createTagAction(workspaceId, {
        name: newTagName.trim(),
        color: newTagColor,
      })
      if (created.error) {
        toast.error(created.error.message)
        return
      }
      await assignTag(created.data.id)
      setNewTagName("")
      setTagDialogOpen(false)
    })
  }

  async function onDelete() {
    const result = await deleteContactAction(workspaceId, contactId)
    if (result.error) {
      toast.error(result.error.message)
      return
    }
    toast.success("Contact deleted")
    router.push(`/${workspaceSlug}/contacts`)
    router.refresh()
  }

  const canDelete = role === "ADMIN" || role === "OWNER"

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Select
        value={currentOwnerId ?? "unassigned"}
        onValueChange={(v) => v && changeOwner(v)}
      >
        <SelectTrigger className="w-auto gap-2" size="sm">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="unassigned">Unassigned</SelectItem>
          {members.map((m) => (
            <SelectItem key={m.user.id} value={m.user.id}>
              <span className="inline-flex items-center gap-1.5">
                <Avatar className="size-4">
                  <AvatarFallback className="text-[8px]">
                    {m.user.name.slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                {m.user.name}
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <ContactFormDialog
        workspaceId={workspaceId}
        organizations={organizations}
        contact={contact}
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

      <Dialog open={tagDialogOpen} onOpenChange={setTagDialogOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Add a tag</DialogTitle>
            <DialogDescription>
              Pick an existing tag or create a new one.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap gap-1.5">
              {tags
                .filter((t) => !currentTagIds.includes(t.id))
                .map((tag) => (
                  <button
                    key={tag.id}
                    type="button"
                    onClick={() => assignTag(tag.id)}
                    className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition-colors hover:bg-accent"
                  >
                    <span
                      className="size-2 rounded-full"
                      style={{ backgroundColor: tag.color }}
                    />
                    {tag.name}
                  </button>
                ))}
              {tags.filter((t) => !currentTagIds.includes(t.id)).length === 0 && (
                <p className="text-sm text-muted-foreground">
                  All tags are already on this contact.
                </p>
              )}
            </div>
            <form onSubmit={createAndAssign} className="flex flex-col gap-2">
              <Input
                value={newTagName}
                onChange={(e) => setNewTagName(e.target.value)}
                placeholder="New tag name…"
              />
              <div className="flex items-center justify-between">
                <div className="flex gap-1">
                  {PRESET_COLORS.map((color) => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => setNewTagColor(color)}
                      className={`size-5 rounded-full border-2 transition-transform ${
                        newTagColor === color
                          ? "scale-110 border-foreground"
                          : "border-transparent"
                      }`}
                      style={{ backgroundColor: color }}
                      aria-label={`Use color ${color}`}
                    />
                  ))}
                </div>
                <Button
                  type="submit"
                  size="sm"
                  disabled={isPending || !newTagName.trim()}
                >
                  {isPending && (
                    <LoaderCircle data-icon="inline-start" className="animate-spin" />
                  )}
                  <Plus data-icon="inline-start" />
                  Create & add
                </Button>
              </div>
            </form>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this contact?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes the contact and all their activity.
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
