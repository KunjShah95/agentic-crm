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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { StageKind } from "@/lib/pipeline-stages"

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
  stages: {
    id: string
    name: string
    color: string
    order: number
    kind: StageKind
    _count: { deals: number }
  }[]
}) {
  const router = useRouter()
  const [open, setOpen] = React.useState(false)
  const [editing, setEditing] = React.useState<
    { id: string; name: string; color: string; kind: StageKind } | null
  >(null)
  const [name, setName] = React.useState("")
  const [color, setColor] = React.useState(STAGE_COLORS[4])
  const [kind, setKind] = React.useState<StageKind>("OPEN")
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
    setKind("OPEN")
    setOpen(true)
  }

  function openEdit(stage: { id: string; name: string; color: string; kind: StageKind }) {
    setEditing(stage)
    setName(stage.name)
    setColor(stage.color)
    setKind(stage.kind)
    setOpen(true)
  }

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!name.trim()) return
    startTransition(async () => {
      const payload = { name: name.trim(), color, kind }
      const result = editing
        ? await updateStageAction(workspaceId, editing.id, payload)
        : await createStageAction(workspaceId, payload)
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
                        {/* The kind is what the revenue maths reads, so it has to
                            be visible here — a stage whose kind is wrong is
                            otherwise invisible until a dashboard number looks
                            off, with nothing pointing back at this setting. */}
                        {stage.kind !== "OPEN" ? (
                          <span className="rounded-xs border border-border px-1.5 py-0.5 text-[10px] font-bold tracking-[0.08em] uppercase text-muted-foreground">
                            {stage.kind === "WON" ? "Won" : "Lost"}
                          </span>
                        ) : null}
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
            <Field>
              <FieldLabel htmlFor="stage-kind">Meaning</FieldLabel>
              {/*
                Set separately from the name on purpose. The name is free text and
                the kind is what decides whether deals here count as revenue — so
                renaming a stage can no longer change what it means, which is the
                failure this replaces.
              */}
              <Select value={kind} onValueChange={(v) => setKind(v as StageKind)}>
                <SelectTrigger id="stage-kind" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="OPEN">Open — still in play</SelectItem>
                  <SelectItem value="WON">Won — closed as revenue</SelectItem>
                  <SelectItem value="LOST">Lost — closed without revenue</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Deals in a Won stage are counted as revenue and dated by the day they moved
                here. This is not affected by the name above.
              </p>
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
