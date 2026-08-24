"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { GripVertical, LoaderCircle, Pencil, Plus, Trash2 } from "lucide-react"
import { DragDropContext, Draggable, Droppable, type DropResult } from "@hello-pangea/dnd"

import {
  createStageAction,
  deleteStageAction,
  reorderStagesAction,
  updateStageAction,
} from "@/lib/actions/deals"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Field,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"

const STAGE_COLORS = [
  "#64748b",
  "#ef4444",
  "#f59e0b",
  "#10b981",
  "#3b82f6",
  "#8b5cf6",
  "#ec4899",
]

export function StageManager({
  workspaceId,
  stages,
}: {
  workspaceId: string
  stages: { id: string; name: string; color: string; order: number; _count: { deals: number } }[]
}) {
  const router = useRouter()
  const [open, setOpen] = React.useState(false)
  const [editing, setEditing] = React.useState<
    { id: string; name: string; color: string } | null
  >(null)
  const [name, setName] = React.useState("")
  const [color, setColor] = React.useState(STAGE_COLORS[4])
  const [isPending, startTransition] = React.useTransition()
  const [localStages, setLocalStages] = React.useState(stages)
  const [prevStages, setPrevStages] = React.useState(stages)
  if (prevStages !== stages) {
    setPrevStages(stages)
    setLocalStages(stages)
  }

  function openCreate() {
    setEditing(null)
    setName("")
    setColor(STAGE_COLORS[4])
    setOpen(true)
  }

  function openEdit(stage: { id: string; name: string; color: string }) {
    setEditing(stage)
    setName(stage.name)
    setColor(stage.color)
    setOpen(true)
  }

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!name.trim()) return
    startTransition(async () => {
      const result = editing
        ? await updateStageAction(workspaceId, editing.id, { name: name.trim(), color })
        : await createStageAction(workspaceId, { name: name.trim(), color })
      if (result.error) {
        toast.error(result.error.message)
        return
      }
      toast.success(editing ? "Stage updated" : "Stage created")
      setOpen(false)
      router.refresh()
    })
  }

  async function onDelete(stageId: string) {
    const result = await deleteStageAction(workspaceId, stageId)
    if (result.error) {
      toast.error(result.error.message)
      return
    }
    toast.success("Stage deleted")
    router.refresh()
  }

  async function onReorder(result: DropResult) {
    if (!result.destination) return
    const from = result.source.index
    const to = result.destination.index
    if (from === to) return
    const reordered = [...localStages]
    const [moved] = reordered.splice(from, 1)
    reordered.splice(to, 0, moved)
    const previous = localStages
    setLocalStages(reordered)
    const res = await reorderStagesAction(
      workspaceId,
      reordered.map((s) => s.id)
    )
    if (res.error) {
      setLocalStages(previous)
      toast.error(res.error.message)
      return
    }
    toast.success("Pipeline reordered")
    router.refresh()
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button variant="outline" size="sm" onClick={openCreate}>
            <Plus data-icon="inline-start" />
            Stage
          </Button>
        }
      />

      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{editing ? "Edit stage" : "Add a stage"}</DialogTitle>
          <DialogDescription>
            Stages make up your pipeline — drag to reorder. Deal stage changes are auto-logged.
          </DialogDescription>
        </DialogHeader>

        <DragDropContext onDragEnd={onReorder}>
          <Droppable droppableId="stages">
            {(provided) => (
              <div ref={provided.innerRef} {...provided.droppableProps} className="flex flex-col gap-1">
                {localStages.map((stage, index) => (
                  <Draggable key={stage.id} draggableId={stage.id} index={index}>
                    {(dragProvided, snapshot) => (
                      <div
                        ref={dragProvided.innerRef}
                        {...dragProvided.draggableProps}
                        className={`flex items-center gap-2.5 rounded-md border bg-card px-3 py-2 ${snapshot.isDragging ? "shadow-md ring-2 ring-primary/20" : ""}`}
                      >
                        <span {...dragProvided.dragHandleProps} className="cursor-grab text-muted-foreground">
                          <GripVertical className="size-4" />
                        </span>
                        <span
                          className="size-3 rounded-full"
                          style={{ backgroundColor: stage.color }}
                        />
                        <span className="flex-1 text-sm font-medium">{stage.name}</span>
                        <span className="text-xs text-muted-foreground">
                          {stage._count.deals} deal{stage._count.deals !== 1 ? "s" : ""}
                        </span>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-7"
                          onClick={() => openEdit(stage)}
                        >
                          <Pencil />
                          <span className="sr-only">Edit</span>
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-7 text-destructive"
                          onClick={() => onDelete(stage.id)}
                        >
                          <Trash2 />
                          <span className="sr-only">Delete</span>
                        </Button>
                      </div>
                    )}
                  </Draggable>
                ))}
                {provided.placeholder}
              </div>
            )}
          </Droppable>
        </DragDropContext>

        <form onSubmit={onSubmit} className="flex flex-col gap-4 border-t pt-4">
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="stage-name">Stage name</FieldLabel>
              <Input
                id="stage-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Discovery"
                required
              />
            </Field>
            <Field>
              <FieldLabel>Color</FieldLabel>
              <div className="flex gap-1.5">
                {STAGE_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setColor(c)}
                    className={`size-7 rounded-full border-2 transition-transform ${
                      color === c
                        ? "scale-110 border-foreground"
                        : "border-transparent"
                    }`}
                    style={{ backgroundColor: c }}
                    aria-label={`Use color ${c}`}
                  />
                ))}
              </div>
            </Field>
          </FieldGroup>
          <DialogFooter>
            <Button type="submit" disabled={isPending || !name.trim()}>
              {isPending && (
                <LoaderCircle data-icon="inline-start" className="animate-spin" />
              )}
              {editing ? "Save changes" : "Add stage"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
