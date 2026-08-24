"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { DragDropContext, Draggable, Droppable, type DropResult } from "@hello-pangea/dnd"
import { GripVertical } from "lucide-react"

import { moveDealStageAction } from "@/lib/actions/deals"
import { formatDate, formatMoney, initials } from "@/lib/format"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"

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

  // Keep local state in sync when the server re-renders (after refresh) —
  // adjust state during render, per the React docs pattern
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

    // Optimistic update
    const previous = localDeals
    setLocalDeals((prev) =>
      prev.map((deal) =>
        deal.id === draggableId
          ? { ...deal, stageId: destination.droppableId }
          : deal
      )
    )

    const res = await moveDealStageAction(
      workspaceId,
      draggableId,
      destination.droppableId
    )
    if (res.error) {
      setLocalDeals(previous)
      toast.error(res.error.message)
      return
    }
    toast.success("Deal moved")
    router.refresh()
  }

  return (
    <DragDropContext onDragEnd={onDragEnd}>
      <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-2 md:-mx-6 md:px-6">
        {stages.map((stage) => {
          const stageDeals = byStage.get(stage.id) ?? []
          const total = stageDeals.reduce((sum, d) => sum + (d.value ?? 0), 0)
          return (
            <div key={stage.id} className="flex w-72 shrink-0 flex-col">
              <div className="mb-2 flex items-center gap-2 px-1">
                <span
                  className="size-2.5 rounded-full"
                  style={{ backgroundColor: stage.color }}
                />
                <span className="text-sm font-semibold">{stage.name}</span>
                <span className="text-xs text-muted-foreground">
                  {stageDeals.length}
                </span>
                <span className="ml-auto text-xs font-medium text-muted-foreground">
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
                        ? "border-primary/40 bg-primary/5"
                        : ""
                    }`}
                  >
                    {stageDeals.length === 0 && !snapshot.isDraggingOver && (
                      <p className="px-2 py-4 text-center text-xs text-muted-foreground">
                        Drop deals here
                      </p>
                    )}
                    {stageDeals.map((deal, index) => (
                      <Draggable key={deal.id} draggableId={deal.id} index={index}>
                        {(dragProvided, dragSnapshot) => (
                          <div
                            ref={dragProvided.innerRef}
                            {...dragProvided.draggableProps}
                            {...dragProvided.dragHandleProps}
                            className={`rounded-lg border bg-card p-3 shadow-sm transition-shadow ${
                              dragSnapshot.isDragging
                                ? "shadow-lg ring-2 ring-primary/30"
                                : "hover:shadow-md"
                            }`}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <Link
                                href={`/${workspaceSlug}/deals/${deal.id}`}
                                className="text-sm font-medium leading-snug hover:underline"
                              >
                                {deal.title}
                              </Link>
                              <GripVertical className="mt-0.5 size-3.5 shrink-0 text-muted-foreground/50" />
                            </div>

                            <p className="mt-0.5 truncate text-xs text-muted-foreground">
                              {deal.organization?.name ??
                                (deal.contact
                                  ? `${deal.contact.firstName} ${deal.contact.lastName}`
                                  : "No account")}
                            </p>

                            <div className="mt-2.5 flex items-center justify-between">
                              <span className="text-sm font-semibold">
                                {formatMoney(deal.value, deal.currency)}
                              </span>
                              {deal.probability != null && (
                                <Badge variant="secondary" className="text-[10px]">
                                  {deal.probability}%
                                </Badge>
                              )}
                            </div>

                            <div className="mt-2 flex items-center justify-between border-t pt-2">
                              <div className="flex gap-1">
                                {deal.tags.slice(0, 1).map(({ tag }) => (
                                  <span
                                    key={tag.id}
                                    className="size-2 rounded-full"
                                    style={{ backgroundColor: tag.color }}
                                  />
                                ))}
                                {deal.expectedCloseDate && (
                                  <span className="text-[10px] text-muted-foreground">
                                    {formatDate(deal.expectedCloseDate)}
                                  </span>
                                )}
                              </div>
                              {deal.ownerId && users.get(deal.ownerId) ? (
                                <Avatar className="size-5">
                                  <AvatarFallback className="text-[8px]">
                                    {initials(users.get(deal.ownerId)!.name)}
                                  </AvatarFallback>
                                </Avatar>
                              ) : (
                                <Avatar className="size-5">
                                  <AvatarFallback className="text-[8px]">?</AvatarFallback>
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
  )
}
