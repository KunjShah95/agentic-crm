"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  MoreHorizontal,
  Trash2,
} from "lucide-react"

import { deleteDealAction, moveDealStageAction } from "@/lib/actions/deals"
import { formatDate, formatMoney, initials } from "@/lib/format"
import { DealFormDialog } from "@/components/deals/deal-form-dialog"
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Metric, TableTotalsBar, TagPills, WinBar } from "@/components/ui/table-metrics"

type Row = {
  id: string
  title: string
  stageId: string
  value: number | null
  currency: string
  probability: number | null
  expectedCloseDate: Date | null
  ownerId: string | null
  updatedAt: Date
  stage: { id: string; name: string; color: string }
  contact: { id: string; firstName: string; lastName: string } | null
  organization: { id: string; name: string } | null
  owner: { id: string; name: string } | null
  tags?: { tag: { id: string; name: string; color: string } }[]
}

type SortKey = "title" | "value" | "stage" | "updatedAt"

type SortState = { key: SortKey; dir: "asc" | "desc" }

function SortIcon({ sort, column }: { sort: SortState; column: SortKey }) {
  if (sort.key !== column) return <ArrowUpDown className="size-3.5 opacity-50" />
  return sort.dir === "asc" ? (
    <ArrowUp className="size-3.5" />
  ) : (
    <ArrowDown className="size-3.5" />
  )
}

export function DealsTable({
  workspaceSlug,
  workspaceId,
  deals,
  stages,
  contacts,
  organizations,
  members,
}: {
  workspaceSlug: string
  workspaceId: string
  deals: Row[]
  stages: { id: string; name: string; color: string }[]
  contacts: { id: string; firstName: string; lastName: string }[]
  organizations: { id: string; name: string }[]
  members: { userId: string; user: { id: string; name: string } }[]
}) {
  const router = useRouter()
  const [sort, setSort] = React.useState<SortState>({
    key: "updatedAt",
    dir: "desc",
  })
  const [pendingDelete, setPendingDelete] = React.useState<Row | null>(null)
  const [ownerFilter, setOwnerFilter] = React.useState<string>("all")
  const [stageFilter, setStageFilter] = React.useState<string>("all")

  const filtered = React.useMemo(() => {
    return deals.filter((d) => {
      if (ownerFilter === "unassigned" && d.ownerId) return false
      if (ownerFilter !== "all" && ownerFilter !== "unassigned" && d.ownerId !== ownerFilter)
        return false
      if (stageFilter !== "all" && d.stageId !== stageFilter) return false
      return true
    })
  }, [deals, ownerFilter, stageFilter])

  const rows = React.useMemo(() => {
    const sorted = [...filtered].sort((a, b) => {
      const dir = sort.dir === "asc" ? 1 : -1
      switch (sort.key) {
        case "title":
          return a.title.localeCompare(b.title) * dir
        case "value":
          return ((a.value ?? 0) - (b.value ?? 0)) * dir
        case "stage":
          return a.stage.name.localeCompare(b.stage.name) * dir
        case "updatedAt":
          return (a.updatedAt.getTime() - b.updatedAt.getTime()) * dir
      }
    })
    return sorted
  }, [filtered, sort])

  const totals = React.useMemo(() => {
    const sum = filtered.reduce((s, d) => s + (d.value ?? 0), 0)
    const probs = filtered.filter((d) => d.probability != null).map((d) => d.probability as number)
    const avgProb = probs.length
      ? Math.round(probs.reduce((s, p) => s + p, 0) / probs.length)
      : null
    return { sum, avgProb }
  }, [filtered])

  function toggleSort(key: SortKey) {
    setSort((prev) =>
      prev.key === key
        ? { key, dir: prev.dir === "asc" ? "desc" : "asc" }
        : { key, dir: key === "title" ? "asc" : "desc" }
    )
  }

  async function changeStage(dealId: string, stageId: string) {
    const result = await moveDealStageAction(workspaceId, dealId, stageId)
    if (result.error) toast.error(result.error.message)
    else router.refresh()
  }

  async function onDelete(deal: Row) {
    const result = await deleteDealAction(workspaceId, deal.id)
    if (result.error) {
      toast.error(result.error.message)
      return
    }
    toast.success("Deal deleted")
    setPendingDelete(null)
    router.refresh()
  }

  const hasFilters = ownerFilter !== "all" || stageFilter !== "all"

  return (
    <>
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Select value={ownerFilter} onValueChange={(v) => v && setOwnerFilter(v)}>
            <SelectTrigger size="sm" className="w-auto gap-1.5 rounded-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All owners</SelectItem>
              <SelectItem value="unassigned">Unassigned</SelectItem>
              {members.map((m) => (
                <SelectItem key={m.user.id} value={m.user.id}>
                  {m.user.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={stageFilter} onValueChange={(v) => v && setStageFilter(v)}>
            <SelectTrigger size="sm" className="w-auto gap-1.5 rounded-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Any stage</SelectItem>
              {stages.map((stage) => (
                <SelectItem key={stage.id} value={stage.id}>
                  {stage.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {hasFilters && (
            <Button
              variant="ghost"
              size="sm"
              className="rounded-full text-muted-foreground"
              onClick={() => {
                setOwnerFilter("all")
                setStageFilter("all")
              }}
            >
              Clear filters
            </Button>
          )}
        </div>

        <div className="overflow-hidden rounded-xl border bg-card">
          <Table>
          <TableHeader className="[&_th]:h-9 [&_th]:text-[11px] [&_th]:font-medium [&_th]:uppercase [&_th]:tracking-[0.08em] [&_th]:text-muted-foreground">
            <TableRow className="border-b bg-muted/40 hover:bg-muted/40">
              <TableHead>
                <button
                  type="button"
                  onClick={() => toggleSort("title")}
                  className="inline-flex items-center gap-1 font-medium hover:text-foreground"
                >
                  Deal
                  <SortIcon sort={sort} column="title" />
                </button>
              </TableHead>
              <TableHead>
                <button
                  type="button"
                  onClick={() => toggleSort("stage")}
                  className="inline-flex items-center gap-1 font-medium hover:text-foreground"
                >
                  Stage
                  <SortIcon sort={sort} column="stage" />
                </button>
              </TableHead>
              <TableHead className="hidden md:table-cell">
                <button
                  type="button"
                  onClick={() => toggleSort("value")}
                  className="inline-flex items-center gap-1 font-medium hover:text-foreground"
                >
                  Value
                  <SortIcon sort={sort} column="value" />
                </button>
              </TableHead>
              <TableHead className="hidden lg:table-cell">Owner</TableHead>
              <TableHead className="hidden md:table-cell">Win probability</TableHead>
              <TableHead className="hidden sm:table-cell">
                <button
                  type="button"
                  onClick={() => toggleSort("updatedAt")}
                  className="inline-flex items-center gap-1 font-medium hover:text-foreground"
                >
                  Updated
                  <SortIcon sort={sort} column="updatedAt" />
                </button>
              </TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((deal) => (
              <TableRow key={deal.id}>
                <TableCell>
                  <div className="min-w-0">
                    <Link
                      href={`/${workspaceSlug}/deals/${deal.id}`}
                      className="font-medium hover:underline"
                    >
                      {deal.title}
                    </Link>
                    <p className="truncate text-xs text-muted-foreground">
                      {deal.organization?.name ??
                        (deal.contact
                          ? `${deal.contact.firstName} ${deal.contact.lastName}`
                          : "—")}
                    </p>
                    <TagPills tags={deal.tags} />
                  </div>
                </TableCell>
                <TableCell>
                  <Select value={deal.stageId} onValueChange={(v) => v && changeStage(deal.id, v)}>
                    <SelectTrigger className="h-7 w-auto gap-1.5 border-0 bg-transparent px-0 shadow-none focus-visible:ring-0" size="sm">
                      <span className="size-2 rounded-full" style={{ backgroundColor: deal.stage.color }} />
                      <SelectValue>{deal.stage.name}</SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {stages.map((stage) => (
                        <SelectItem key={stage.id} value={stage.id}>
                          {stage.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </TableCell>
                <TableCell className="hidden md:table-cell">
                  <span className="font-medium tabular-nums">
                    {formatMoney(deal.value, deal.currency)}
                  </span>
                </TableCell>
                <TableCell className="hidden lg:table-cell">
                  {deal.owner ? (
                    <span className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
                      <Avatar className="size-5">
                        <AvatarFallback className="text-[9px]">
                          {initials(deal.owner.name)}
                        </AvatarFallback>
                      </Avatar>
                      {deal.owner.name}
                    </span>
                  ) : (
                    <span className="text-sm text-muted-foreground/50">—</span>
                  )}
                </TableCell>
                <TableCell className="hidden md:table-cell">
                  <WinBar value={deal.probability} />
                </TableCell>
                <TableCell className="hidden text-sm text-muted-foreground sm:table-cell">
                  {formatDate(deal.updatedAt)}
                </TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger
                      render={
                        <Button variant="ghost" size="icon" className="size-8">
                          <MoreHorizontal />
                          <span className="sr-only">Actions</span>
                        </Button>
                      }
                    />
                    <DropdownMenuContent align="end">
                      <DealFormDialog
                        workspaceId={workspaceId}
                        stages={stages}
                        contacts={contacts}
                        organizations={organizations}
                        members={members}
                        deal={{
                          id: deal.id,
                          title: deal.title,
                          stageId: deal.stageId,
                          contactId: deal.contact?.id ?? null,
                          organizationId: deal.organization?.id ?? null,
                          value: deal.value,
                          currency: deal.currency,
                          probability: deal.probability,
                          expectedCloseDate: deal.expectedCloseDate,
                          ownerId: deal.ownerId,
                        }}
                        trigger={
                          <span className="w-full px-2 py-1.5 text-sm">Edit</span>
                        }
                      />
                      <DropdownMenuItem
                        variant="destructive"
                        onSelect={() => setPendingDelete(deal)}
                      >
                        <Trash2 />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <TableTotalsBar>
          <span className="font-medium">
            <span className="tabular-nums">{rows.length}</span>{" "}
            <span className="text-muted-foreground">{rows.length === 1 ? "deal" : "deals"} in view</span>
          </span>
          <Metric label="Sum of pipeline" value={formatMoney(totals.sum)} />
          <Metric label="Avg win probability" value={totals.avgProb == null ? "—" : `${totals.avgProb}%`} />
        </TableTotalsBar>
        </div>
      </div>

      <AlertDialog open={!!pendingDelete} onOpenChange={(o) => !o && setPendingDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this deal?</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingDelete
                ? `"${pendingDelete.title}" and its activity will be permanently removed.`
                : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => pendingDelete && onDelete(pendingDelete)}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
