"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Plus, Pencil, Trash2, Check, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
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
import { cn } from "@/lib/utils"
import {
  createTagAction,
  deleteTagAction,
  listTagsAction,
  updateTagAction,
} from "@/lib/actions/tags"

const TAG_COLORS = [
  "#6366f1", "#8b5cf6", "#a855f7", "#ec4899", "#f43f5e",
  "#ef4444", "#f97316", "#f59e0b", "#eab308", "#84cc16",
  "#22c55e", "#10b981", "#14b8a6", "#06b6d4", "#0ea5e9",
  "#3b82f6", "#6b7280",
]

type Tag = {
  id: string
  name: string
  color: string
  _count: { contacts: number; deals: number }
}

interface Props {
  workspaceId: string
  initialTags: Tag[]
}

export function TagManager({ workspaceId, initialTags }: Props) {
  const router = useRouter()
  const [tags, setTags] = useState<Tag[]>(initialTags)
  const [isPending, startTransition] = useTransition()
  const [newTagName, setNewTagName] = useState("")
  const [newTagColor, setNewTagColor] = useState(TAG_COLORS[0])
  const [creating, setCreating] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState("")
  const [editColor, setEditColor] = useState("")
  const [deleteId, setDeleteId] = useState<string | null>(null)

  async function handleCreate() {
    if (!newTagName.trim()) {
      toast.error("Enter a tag name")
      return
    }
    setCreating(true)
    try {
      const result = await createTagAction(workspaceId, { name: newTagName.trim(), color: newTagColor })
      if (result.error) {
        toast.error(result.error.message)
        return
      }
      toast.success("Tag created")
      setNewTagName("")
      setNewTagColor(TAG_COLORS[0])
      refreshTags()
    } finally {
      setCreating(false)
    }
  }

  async function handleUpdate(id: string) {
    if (!editName.trim()) {
      toast.error("Tag name cannot be empty")
      return
    }
    const result = await updateTagAction(workspaceId, id, { name: editName.trim(), color: editColor })
    if (result.error) {
      toast.error(result.error.message)
      return
    }
    toast.success("Tag updated")
    setEditingId(null)
    refreshTags()
  }

  async function handleDelete(id: string) {
    const result = await deleteTagAction(workspaceId, id)
    if (result.error) {
      toast.error(result.error.message)
      return
    }
    toast.success("Tag deleted")
    setDeleteId(null)
    refreshTags()
  }

  function refreshTags() {
    startTransition(async () => {
      const result = await listTagsAction(workspaceId)
      if (result.data) {
        setTags(result.data)
      }
      router.refresh()
    })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-display text-lg">Tags</CardTitle>
        <CardDescription>
          Create and manage tags to organize your contacts and deals.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Create new tag */}
        <div className="flex flex-wrap items-center gap-2">
          <Input
            value={newTagName}
            onChange={(e) => setNewTagName(e.target.value)}
            placeholder="New tag name..."
            className="max-w-xs"
            onKeyDown={(e) => e.key === "Enter" && handleCreate()}
          />
          <div className="flex items-center gap-1">
            {TAG_COLORS.slice(0, 8).map((color) => (
              <button
                key={color}
                className={cn(
                  "size-5 rounded-full border-2 transition-transform hover:scale-110",
                  newTagColor === color ? "border-foreground scale-110" : "border-transparent"
                )}
                style={{ backgroundColor: color }}
                onClick={() => setNewTagColor(color)}
              />
            ))}
          </div>
          <Button size="sm" onClick={handleCreate} disabled={creating || !newTagName.trim()}>
            <Plus className="mr-1 size-3" />
            Add tag
          </Button>
        </div>

        {/* Tag list */}
        {tags.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">
            No tags yet. Create one above to start organizing.
          </p>
        ) : (
          <div className="space-y-1">
            {tags.map((tag) => (
              <div
                key={tag.id}
                className="flex items-center gap-3 rounded-md border px-3 py-2 hover:bg-muted/50"
              >
                {editingId === tag.id ? (
                  <>
                    <div
                      className="size-4 rounded-full shrink-0"
                      style={{ backgroundColor: editColor }}
                    />
                    <Input
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="h-7 max-w-xs text-sm"
                      autoFocus
                      onKeyDown={(e) => e.key === "Enter" && handleUpdate(tag.id)}
                    />
                    <div className="flex items-center gap-0.5 ml-auto">
                      {TAG_COLORS.slice(0, 6).map((color) => (
                        <button
                          key={color}
                          className={cn(
                            "size-4 rounded-full border transition-transform hover:scale-110",
                            editColor === color ? "border-foreground scale-110" : "border-transparent"
                          )}
                          style={{ backgroundColor: color }}
                          onClick={() => setEditColor(color)}
                        />
                      ))}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-7"
                        onClick={() => handleUpdate(tag.id)}
                      >
                        <Check className="size-3.5 text-status-positive-fg" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-7"
                        onClick={() => setEditingId(null)}
                      >
                        <X className="size-3.5" />
                      </Button>
                    </div>
                  </>
                ) : (
                  <>
                    <div
                      className="size-4 rounded-full shrink-0"
                      style={{ backgroundColor: tag.color }}
                    />
                    <span className="text-sm font-medium flex-1">{tag.name}</span>
                    <span className="text-xs text-muted-foreground">
                      {tag._count.contacts + tag._count.deals} uses
                    </span>
                    <div className="flex items-center gap-0.5">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-7"
                        onClick={() => {
                          setEditingId(tag.id)
                          setEditName(tag.name)
                          setEditColor(tag.color)
                        }}
                      >
                        <Pencil className="size-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-7 text-destructive"
                        onClick={() => setDeleteId(tag.id)}
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Delete confirmation */}
        <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete this tag?</AlertDialogTitle>
              <AlertDialogDescription>
                This will remove the tag from all contacts and deals. The tag itself will be permanently deleted.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                onClick={() => deleteId && handleDelete(deleteId)}
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardContent>
    </Card>
  )
}
