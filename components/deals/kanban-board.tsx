"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { DragDropContext, Draggable, Droppable, type DropResult } from "@hello-pangea/dnd"
import { GripVertical, Undo2 } from "lucide-react"

import { moveDealStageAction } from "@/lib/actions/deals"
import { formatDate, formatMoney } from "@/lib/format"
import { initials } from "@/lib/format"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

type BoardStage = {
  id: string
  name: string
  color: string
  order: number
  _count: { deals: number }
}

type BoardDeal = {
  id: string
  title: string
  stageId: string
  value: number | null
  currency: string
  probability: number | null
  expectedCloseDate: Date | null
  ownerId: string | null
  contact: { id: string; firstName: string; lastName: string } | null
  organization: { id: string; name: string } | null
  tags: { tag: { id: string; name: string; color: string } }[]
}

export function KanbanBoard({
  workspaceSlug,
  workspaceId,
  stages,
  deals,
  users,
}: {
  workspaceSlug: string
  workspaceId: string
  stages: BoardStage[]
  deals: BoardDeal[]
  users: Map<string, { name: string }>
}) {
  const router = useRouter()
  const [localDeals, setLocalDeals] = React.useState(deals)
  const [prevDeals, setPrevDeals] = React.useState(deals)
  const [undoStack, setUndoStack] = React.useState<{ dealId: string; fromStageId: string; toStageId: string }[]>([])
  const [mobileStage, setMobileStage] = React.useState(stages[0]?.id ?? "")

  if (prevDeals !== deals) {
    setPrevDeals(deals)
    setLocalDeals(deals)
  }

  const byStage = React.useMemo(() => {
    const map = new Map<string, BoardDeal[]>()
    for (const stage of stages) map.set(stage.id, [])
    for (const deal of localDeals) {
      const list = map.get(deal.stageId)
      if (list) list.push(deal)
    }
    return map
  }, [stages, localDeals])

  async function onDragEnd(result: DropResult) {
    const { source, destination, draggableId } = result
    if (!destination) return
    if (
      source.droppableId === destination.droppableId &&
      source.index === destination.index
    ) {
      return
    }

    const previous = localDeals
    setLocalDeals((prev) =>
      prev.map((deal) =>
        deal.id === draggableId
          ? { ...deal, stageId: destination.droppableId }
          : deal
      )
    )

    setUndoStack((prev) => [
      ...prev.slice(-4),
      { dealId: draggableId, fromStageId: source.droppableId, toStageId: destination.droppableId },
    ])

    const res = await moveDealStageAction(
      workspaceId,
      draggableId,
      destination.droppableId
    )
    if (res.error) {
      setLocalDeals(previous)
      setUndoStack((prev) => prev.slice(0, -1))
      toast.error(res.error.message)
      return
    }
    toast.success("Deal moved", {
      action: {
        label: "Undo",
        onClick: () => undoLastMove(),
      },
      duration: 5000,
    })
    router.refresh()
  }

  function undoLastMove() {
    setUndoStack((prev) => {
      const last = prev[prev.length - 1]
      if (!last) return prev

      setLocalDeals((dl) =>
        dl.map((deal) =>
          deal.id === last.dealId
            ? { ...deal, stageId: last.fromStageId }
            : deal
        )
      )

      moveDealStageAction(workspaceId, last.dealId, last.fromStageId).then(() => {
        router.refresh()
      })

      return prev.slice(0, -1)
    })
  }

  const [isMobile, setIsMobile] = React.useState(false)

  React.useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768)
    check()
    window.addEventListener("resize", check)
    return () => window.removeEventListener("resize", check)
  }, [])

  return (
    <>
      {/* Mobile stage selector */}
      <div className="md:hidden px-4 pb-2">
        <Select value={mobileStage} onValueChange={(v) => v && setMobileStage(v)}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Select stage" />
          </SelectTrigger>
          <SelectContent>
            {stages.map((stage) => (
              <SelectItem key={stage.id} value={stage.id}>
                <span className="flex items-center gap-2">
                  <span
                    className="size-2.5 rounded-full"
                    style={{ backgroundColor: stage.color }}
                  />
                  {stage.name} ({byStage.get(stage.id)?.length ?? 0})
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <DragDropContext onDragEnd={onDragEnd}>
        {/* Desktop: horizontal scroll */}
        <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-2 md:-mx-6 md:px-6">
          {stages.map((stage) => {
            const stageDeals = byStage.get(stage.id) ?? []
            const total = stageDeals.reduce((sum, d) => sum + (d.value ?? 0), 0)
            const isVisible = isMobile ? stage.id === mobileStage : true
            return (
              <div
                key={stage.id}
                className={`flex w-72 shrink-0 flex-col ${!isVisible ? "hidden md:flex" : ""}`}
              >
                <div className="mb-2 flex items-center gap-2 px-1">
                  <span
                    className="size-2.5 rounded-full"
                    style={{ backgroundColor: stage.color }}
                  />
                  <span className="text-sm font-semibold">{stage.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {stageDeals.length}
                  </span>
                  <span className="ml-auto text-xs font-mono font-medium tabular-nums text-muted-foreground">
                    {formatMoney(total)}
                  </span>
                </div>
                <Droppable droppableId={stage.id}>
                  {(provided, snapshot) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.droppableProps}
                      className={`flex min-h-24 flex-col gap-2 rounded-xl border bg-muted/40 p-2 transition-colors ${
                        snapshot.isDraggingOver
                          ? "border-brand/40 bg-brand/5"
                          : ""
                      }`}
                    >
                      {stageDeals.length === 0 && !snapshot.isDraggingOver && (
                        <p className="px-2 py-4 text-center text-xs text-muted-foreground">
                          No deals in this stage yet
                        </p>
                      )}
                      {stageDeals.map((deal, index) => (
                        <Draggable key={deal.id} draggableId={deal.id} index={index}>
                          {(dragProvided, dragSnapshot) => (
                            <div
                              ref={dragProvided.innerRef}
                              {...dragProvided.draggableProps}
                              {...dragProvided.dragHandleProps}
                              className={`rounded-lg border bg-card p-3 shadow-xs transition-all ${
                                dragSnapshot.isDragging
                                  ? "shadow-md ring-2 ring-brand/40"
                                  : "hover:border-border/80 hover:shadow-xs"
                              }`}
                            >
                              <div className="flex items-start justify-between gap-2">
                                <Link
                                  href={`/${workspaceSlug}/deals/${deal.id}`}
                                  className="text-sm font-medium leading-snug hover:underline hover:text-brand transition-colors"
                                >
                                  {deal.title}
                                </Link>
                                <GripVertical className="mt-0.5 size-4 shrink-0 text-muted-foreground/40" />
                              </div>

                              <p className="mt-0.5 truncate text-xs text-muted-foreground">
                                {deal.organization?.name ??
                                  (deal.contact
                                    ? `${deal.contact.firstName} ${deal.contact.lastName}`
                                    : "No account")}
                              </p>

                              <div className="mt-2.5 flex items-center justify-between">
                                <span className="text-sm font-semibold font-mono tabular-nums">
                                  {formatMoney(deal.value, deal.currency)}
                                </span>
                                {deal.probability != null && (
                                  <Badge variant="secondary" className="text-[10px]">
                                    {deal.probability}%
                                  </Badge>
                                )}
                              </div>

                              <div className="mt-2 flex items-center justify-between border-t pt-2">
                                <div className="flex items-center gap-1.5">
                                  {deal.tags.slice(0, 3).map(({ tag }) => (
                                    <span
                                      key={tag.id}
                                      className="size-2 rounded-full"
                                      style={{ backgroundColor: tag.color }}
                                      title={tag.name}
                                    />
                                  ))}
                                  {deal.expectedCloseDate && (
                                    <span className="text-[10px] text-muted-foreground">
                                      {formatDate(deal.expectedCloseDate)}
                                    </span>
                                  )}
                                </div>
                                {deal.ownerId && users.has(deal.ownerId) && (
                                  <Avatar className="size-5" title={users.get(deal.ownerId)?.name}>
                                    <AvatarFallback className="text-[9px]">
                                      {initials(users.get(deal.ownerId)?.name ?? "")}
                                    </AvatarFallback>
                                  </Avatar>
                                )}
                              </div>
                            </div>
                          )}
                        </Draggable>
                      ))}
                      {provided.placeholder}
                    </div>
                  )}
                </Droppable>
              </div>
            )
          })}
        </div>
      </DragDropContext>
    </>
  )
}
