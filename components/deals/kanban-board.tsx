"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { DragDropContext, Draggable, Droppable, type DropResult } from "@hello-pangea/dnd"
import { GripVertical } from "lucide-react"

import { moveDealStageAction } from "@/lib/actions/deals"

/** How long a stage-move toast stays actionable. See the `toast.success` call. */
const MOVE_UNDO_WINDOW_MS = 8_000
import { formatDate, formatMoney } from "@/lib/format"
import { initials } from "@/lib/format"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
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
  /**
   * One stage move, recorded so it can be reverted from the toast.
   *
   * This was held in an array used as a LIFO stack, and the Undo button in the
   * toast popped the top entry. That is only correct if there is ever exactly one
   * undoable move on screen — and there is not: every drag produces its own toast
   * that lives for `MOVE_UNDO_WINDOW_MS`, so dragging deal A then deal B leaves two
   * toasts on screen and clicking the *older* one reverted B. The state was also
   * capped at five entries, so an undo on a move that had aged out silently did
   * nothing while the toast still offered it.
   *
   * Per-move is the correct granularity: the toast *is* the affordance, so it
   * already identifies which move it is for. The array was the only thing
   * preventing that, and it is gone.
   */
  type StageMove = { dealId: string; fromStageId: string; toStageId: string }
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

    const move: StageMove = {
      dealId: draggableId,
      fromStageId: source.droppableId,
      toStageId: destination.droppableId,
    }

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
    toast.success("Deal moved", {
      action: {
        label: "Undo",
        onClick: () => undoMove(move),
      },
      // A stage change is not a cosmetic toggle — it can change commission,
      // forecast and reporting — so the window to take it back should be longer
      // than the window in which the toast can be read. Sonner's default for an
      // action toast is 4s, which is about how long it takes to glance at a
      // message and not process the button.
      duration: MOVE_UNDO_WINDOW_MS,
    })
    router.refresh()
  }

  /**
   * Revert one specific move — the one this toast belongs to.
   *
   * Guarded on the deal still being in the stage the move put it in. Dragging a
   * deal twice leaves the first toast's Undo still on screen, and honouring it
   * would throw away the second, newer decision and leave the board showing a
   * stage the user moved it away from. In that case the toast is simply spent.
   */
  async function undoMove(move: StageMove) {
    const current = localDeals.find((d) => d.id === move.dealId)
    if (!current || current.stageId !== move.toStageId) return

    setLocalDeals((dl) =>
      dl.map((deal) =>
        deal.id === move.dealId ? { ...deal, stageId: move.fromStageId } : deal
      )
    )

    const res = await moveDealStageAction(workspaceId, move.dealId, move.fromStageId)
    if (res.error) {
      // Put the card back where it was rather than leaving the optimistic revert
      // standing — the server still has it in the newer stage.
      setLocalDeals((dl) =>
        dl.map((deal) => (deal.id === move.dealId ? current : deal))
      )
      toast.error(`Could not undo the move: ${res.error.message}`)
      return
    }
    toast.success("Move undone")
    router.refresh()
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
        {/* Desktop: horizontal scroll with snap on mobile */}
        <div className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2 md:-mx-6 md:px-6 md:snap-none">
          {stages.map((stage) => {
            const stageDeals = byStage.get(stage.id) ?? []
            const total = stageDeals.reduce((sum, d) => sum + (d.value ?? 0), 0)
            const isVisible = isMobile ? stage.id === mobileStage : true
            return (
              <div
                key={stage.id}
                className={`flex w-72 shrink-0 snap-start flex-col ${!isVisible ? "hidden md:flex" : ""}`}
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
                  <span className="ml-auto text-xs font-medium tabular-nums text-muted-foreground">
                    {formatMoney(total)}
                  </span>
                </div>
                <Droppable droppableId={stage.id}>
                  {(provided, snapshot) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.droppableProps}
                      className={`flex min-h-24 flex-col gap-2 rounded-md border bg-muted/40 p-2 transition-colors ${
                        snapshot.isDraggingOver
                          ? "border-brand/40 bg-brand/5"
                          : ""
                      }`}
                    >
                      {stageDeals.length === 0 && !snapshot.isDraggingOver && (
                        <p className="rounded-md border border-dashed px-2 py-4 text-center text-xs text-muted-foreground">
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
                              /* Named properties, never `transition-all` — an
                                 all-property transition picks up layout-affecting
                                 properties the moment anything in the card tree
                                 changes size, which on a drag surface is how a
                                 card starts jittering. See the same rule in
                                 components/shell/sidebar.tsx. */
                              className={`rounded-md border bg-card p-3 shadow-xs transition-[box-shadow,border-color] ${
                                dragSnapshot.isDragging
                                  ? "shadow-md ring-2 ring-brand/40"
                                  : "hover:border-border/80 hover:shadow-xs"
                              }`}
                            >
                              <div className="flex items-start justify-between gap-2">
                                <Link
                                  href={`/${workspaceSlug}/deals/${deal.id}`}
                                  /* No `.tap-target` here: this link is inside a
                                     dnd-kit drag handle, and an ::after overlay on
                                     the dragged element is how a drag turns into a
                                     mis-tap. The card itself is the touch target
                                     here, and the title link is the keyboard and
                                     pointer path into it. */
                                  className="text-sm font-medium leading-snug hover:underline hover:text-brand-solid transition-colors"
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
                                <span className="text-[15px] font-semibold tabular-nums">
                                  {formatMoney(deal.value, deal.currency)}
                                </span>
                                {deal.probability != null && (
                                  <Badge variant="secondary" className="px-1.5 py-px text-[10px]">
                                    {deal.probability}%
                                  </Badge>
                                )}
                              </div>

                              <div className="mt-2 flex items-center justify-between border-t pt-2">
                                <div className="flex items-center gap-1.5">
                                  {deal.tags.slice(0, 3).map(({ tag }) => (
                                    <span
                                      key={tag.id}
                                      className="size-1.5 rounded-full"
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
