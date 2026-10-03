"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { toast } from "sonner"
import {
  Download,
  Filter,
  MoreHorizontal,
  Phone,
  Search,
  Tag as TagIcon,
  Upload,
  UserRound,
  Users,
} from "lucide-react"
import { cn } from "@/lib/utils"
import {
  bulkAssignContactsAction,
  bulkTagContactsAction,
  deleteContactAction,
  exportContactsCsvAction,
} from "@/lib/actions/contacts"
import { fullName, formatDate, initials } from "@/lib/format"
import { ContactFormDialog } from "@/components/contacts/contact-form-dialog"
import { ImportContactsDialog } from "@/components/contacts/import-contacts-dialog"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { MobileCardRow } from "@/components/ui/responsive-table"
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
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination"
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
  TableRow,
} from "@/components/ui/table"
import { Metric, TableTotalsBar, TagPills } from "@/components/ui/table-metrics"
import {
  BulkActionBar,
  DataSurface,
  DataTableHeader,
  RowActions,
  ROW_CLASS,
  rowEnterStyle,
} from "@/components/shell/data-surface"
import { EmptyState } from "@/components/shell/empty-state"
import { Spinner } from "@/components/ui/spinner"

type ContactRow = {
  id: string
  firstName: string
  lastName: string
  email: string | null
  phone: string | null
  linkedinUrl: string | null
  jobTitle: string | null
  organizationId: string | null
  owner: { id: string; name: string } | null
  createdAt: Date
  organization: { id: string; name: string } | null
  tags: { tag: { id: string; name: string; color: string } }[]
}

type Member = { userId: string; user: { id: string; name: string; email: string } }

export function ContactsTable({
  workspaceSlug,
  workspaceId,
  role,
  data,
  filters,
  tags,
  orgs,
  members,
}: {
  workspaceSlug: string
  workspaceId: string
  role: string
  data: {
    items: ContactRow[]
    total: number
    page: number
    totalPages: number
  }
  filters: {
    q?: string
    tagId?: string
    organizationId?: string
    ownerId?: string
    sort?: "newest" | "oldest" | "name" | "updated"
  }
  tags: { id: string; name: string; color: string }[]
  orgs: { id: string; name: string }[]
  members: Member[]
}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const [selected, setSelected] = React.useState<Set<string>>(new Set())
  const [query, setQuery] = React.useState(filters.q ?? "")
  const [pendingDelete, setPendingDelete] = React.useState<ContactRow | null>(null)
  const [tagDialogOpen, setTagDialogOpen] = React.useState(false)
  const [assignDialogOpen, setAssignDialogOpen] = React.useState(false)
  const [exporting, setExporting] = React.useState(false)
  const [selectedTagIds, setSelectedTagIds] = React.useState<string[]>([])
  const [assignOwnerId, setAssignOwnerId] = React.useState<string>("")
  const [filtersOpen, setFiltersOpen] = React.useState(false)
  const [importDialogOpen, setImportDialogOpen] = React.useState(false)

  /**
   * Search, filters and pagination all resolve into the URL, so the view is
   * shareable and the back button works.
   *
   * The writes go through `startTransition`, which is what surfaces `pending`.
   * Without it the filter change fires a server render with no feedback at all:
   * the old rows stay on screen looking authoritative while the new ones are
   * still in flight, and there is nothing to tell the user the click landed.
   */
  const [isNavigating, startNavigation] = React.useTransition()

  function commit(mutate: (params: URLSearchParams) => void) {
    const params = new URLSearchParams(searchParams.toString())
    mutate(params)
    // Any filter change invalidates the current page number — staying on page
    // 4 of a result set that now has two pages is the classic off-by-one empty.
    if (!params.has("page")) params.delete("page")
    startNavigation(() => {
      router.replace(`${pathname}?${params.toString()}`, { scroll: false })
    })
  }

  // Debounced search → URL. 350ms is long enough that a five-letter name does
  // not fire five round-trips, short enough that the pause before results
  // appear does not register as lag.
  React.useEffect(() => {
    const timer = setTimeout(() => {
      commit((params) => {
        if (query.trim()) params.set("q", query.trim())
        else params.delete("q")
        params.delete("page")
      })
    }, 350)
    return () => clearTimeout(timer)
    // `commit` is intentionally excluded: it closes over the live `searchParams`,
    // and this effect must only re-arm when the query itself changes. Including
    // it would restart the debounce on every render and the input would never
    // settle.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query])

  function updateParam(key: string, value: string | null) {
    commit((params) => {
      if (value && value !== "all") params.set(key, value)
      else params.delete(key)
    })
  }

  function goToPage(page: number) {
    commit((params) => {
      if (page > 1) params.set("page", String(page))
      else params.delete("page")
    })
  }

  /** How many filters are currently narrowing the result set. */
  const activeFilterCount = [filters.tagId, filters.organizationId, filters.ownerId].filter(
    Boolean
  ).length

  const hasActiveFilters = Boolean(filters.q) || activeFilterCount > 0

  /** One place to undo every filter — the empty state and the toolbar share it. */
  function clearAllFilters() {
    setQuery("")
    commit((params) => {
      for (const key of ["q", "tag", "org", "owner"]) params.delete(key)
    })
  }

  const allSelected =
    data.items.length > 0 && data.items.every((c) => selected.has(c.id))

  function toggleAll() {
    setSelected((prev) => {
      const next = new Set(prev)
      if (allSelected) data.items.forEach((c) => next.delete(c.id))
      else data.items.forEach((c) => next.add(c.id))
      return next
    })
  }

  async function runExport(ids?: string[]) {
    setExporting(true)
    try {
      const result = await exportContactsCsvAction(workspaceId, {
        ...filters,
        ids,
        pageSize: 1000,
      })
      if (result.error) {
        toast.error(result.error.message)
        return
      }
      const blob = new Blob([result.data.content], { type: "text/csv;charset=utf-8" })
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = result.data.filename
      a.click()
      URL.revokeObjectURL(url)
      toast.success(`Exported ${result.data.content.split("\n").length - 1} contacts`)
    } finally {
      setExporting(false)
    }
  }

  async function onDelete(contact: ContactRow) {
    const result = await deleteContactAction(workspaceId, contact.id)
    if (result.error) {
      toast.error(result.error.message)
      return
    }
    toast.success("Contact deleted")
    setPendingDelete(null)
    router.refresh()
  }

  async function onApplyTags() {
    const result = await bulkTagContactsAction(workspaceId, {
      contactIds: [...selected],
      tagIds: selectedTagIds,
    })
    if (result.error) {
      toast.error(result.error.message)
      return
    }
    toast.success(`Tagged ${selected.size} contact${selected.size > 1 ? "s" : ""}`)
    setTagDialogOpen(false)
    setSelectedTagIds([])
    router.refresh()
  }

  async function onApplyAssign() {
    if (!assignOwnerId) {
      toast.error("Pick an owner first")
      return
    }
    const result = await bulkAssignContactsAction(workspaceId, {
      contactIds: [...selected],
      ownerId: assignOwnerId,
    })
    if (result.error) {
      toast.error(result.error.message)
      return
    }
    toast.success(`Assigned ${selected.size} contacts`)
    setAssignDialogOpen(false)
    setAssignOwnerId("")
    router.refresh()
  }

  const canDelete = role === "ADMIN" || role === "OWNER"

  return (
    <div className="flex flex-col gap-4">
      {/*
        A hairline progress rail at the top of the data region while a filter
        change is in flight. This is the single highest-value affordance on the
        page: without it, typing in the search box or picking a stage leaves the
        previous rows sitting there looking like the answer, with nothing to
        indicate a fetch is underway. A rail — rather than a spinner or an
        overlay — keeps the rows readable and still unmissable, and it costs
        2px of layout that does not shift anything below it.
      */}
      <div
        aria-hidden
        className={cn(
          "h-0.5 -mt-4 overflow-hidden rounded-full bg-transparent transition-colors duration-150",
          isNavigating && "bg-brand/20"
        )}
      >
        <div
          className={cn(
            "h-full origin-left rounded-full bg-brand transition-transform duration-300 [transition-timing-function:var(--ease-out)]",
            isNavigating ? "scale-x-75" : "scale-x-0"
          )}
        />
      </div>
      <span aria-live="polite" className="sr-only">
        {isNavigating ? "Updating contacts" : `${data.total} contacts`}
      </span>

      {/* Toolbar */}
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-0 flex-1">
            <Search
              aria-hidden
              className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
            />
            <Input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search contacts…"
              aria-label="Search contacts"
              // `type="search"` so mobile keyboards offer a search key and
              // Safari renders its own clear affordance.
              className="pl-8 [&::-webkit-search-cancel-button]:hidden"
            />
          </div>

          {/*
            The Filters button only appears when a filter would actually be
            hidden. A count on the label tells the user whether the collapsed
            panel is doing anything — otherwise "Filters" is a button that
            silently changes the result set, which is the worst version of this
            control.
          */}
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 md:hidden"
            aria-expanded={filtersOpen}
            onClick={() => setFiltersOpen((o) => !o)}
          >
            <Filter className="size-3.5" />
            Filters
            {activeFilterCount > 0 ? (
              <span className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-brand-solid px-1 text-[10px] font-semibold tabular-nums text-brand-foreground">
                {activeFilterCount}
              </span>
            ) : null}
          </Button>

          <div className={cn("flex flex-wrap items-center gap-2", "max-md:w-full", !filtersOpen && "max-md:hidden")}>
            <Select
              value={filters.organizationId ?? "all"}
              onValueChange={(v) => updateParam("org", v)}
            >
              <SelectTrigger className="w-auto gap-2">
                <SelectValue placeholder="Company" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All companies</SelectItem>
                {orgs.map((org) => (
                  <SelectItem key={org.id} value={org.id}>
                    {org.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={filters.tagId ?? "all"}
              onValueChange={(v) => updateParam("tag", v)}
            >
              <SelectTrigger className="w-auto gap-2">
                <SelectValue placeholder="Tag" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All tags</SelectItem>
                {tags.map((tag) => (
                  <SelectItem key={tag.id} value={tag.id}>
                    {tag.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={filters.ownerId ?? "all"}
              onValueChange={(v) => updateParam("owner", v)}
            >
              <SelectTrigger className="w-auto gap-2">
                <SelectValue placeholder="Owner" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All owners</SelectItem>
                {members.map((m) => (
                  <SelectItem key={m.user.id} value={m.user.id}>
                    {m.user.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={filters.sort ?? "newest"}
              onValueChange={(v) => updateParam("sort", v)}
            >
              <SelectTrigger className="w-auto gap-2">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="newest">Newest first</SelectItem>
                <SelectItem value="oldest">Oldest first</SelectItem>
                <SelectItem value="name">Name A→Z</SelectItem>
                <SelectItem value="updated">Recently updated</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/*
            Past `sm`, Import and Export collapse to icon buttons so the
            labelled "Add contact" action keeps the strongest position in the
            toolbar — two labelled buttons competing beside it is how the
            primary action ends up being the one you have to hunt for. The
            `sr-only` label is the accessible name in both forms.

            Below `sm` they stay labelled. A phone has room for one clear
            primary action, not three, and an unexplained icon in a toolbar is
            a dead end for anyone who does not already know what an upload
            glyph means.
          */}
          <Button
            variant="outline"
            size="icon"
            className="hidden sm:inline-flex"
            onClick={() => setImportDialogOpen(true)}
            title="Import contacts from CSV"
          >
            <Upload />
            <span className="sr-only">Import CSV</span>
          </Button>

          <Button
            variant="outline"
            size="icon"
            className="hidden sm:inline-flex"
            onClick={() => runExport()}
            disabled={exporting}
            title={exporting ? "Preparing export…" : "Export contacts to CSV"}
          >
            {exporting ? (
              <Spinner className="size-4" />
            ) : (
              <Download />
            )}
            <span className="sr-only">Export CSV</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 sm:hidden"
            onClick={() => setImportDialogOpen(true)}
          >
            <Upload className="size-3.5" />
            Import
          </Button>

          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 sm:hidden"
            onClick={() => runExport()}
            disabled={exporting}
          >
            {exporting ? <Spinner className="size-3.5" /> : <Download className="size-3.5" />}
            Export
          </Button>

          <ContactFormDialog
            workspaceId={workspaceId}
            organizations={orgs}
            trigger={
              <Button size="sm">
                <Users data-icon="inline-start" />
                Add contact
              </Button>
            }
          />
        </div>
      </div>

      {/* Bulk action bar — same component the deals table uses. */}
      {selected.size > 0 && (
        <BulkActionBar count={selected.size} onClear={() => setSelected(new Set())}>
          <Button variant="outline" size="sm" onClick={() => setTagDialogOpen(true)}>
            <TagIcon data-icon="inline-start" />
            Tag
          </Button>
          <Button variant="outline" size="sm" onClick={() => setAssignDialogOpen(true)}>
            <UserRound data-icon="inline-start" />
            Assign owner
          </Button>
          <Button variant="outline" size="sm" onClick={() => runExport([...selected])}>
            <Download data-icon="inline-start" />
            Export
          </Button>
        </BulkActionBar>
      )}

      {/* Table */}
      {data.items.length === 0 ? (
        <DataSurface>
          {/*
            "No contacts yet" and "no contacts match" are different failures.
            Telling someone their first contact does not exist when they have
            typed a bad filter is the most disorienting thing an empty state
            can do, so the two branches get different copy and different
            actions.
          */}
          <EmptyState
            icon={Users}
            title={hasActiveFilters ? "No contacts match these filters" : "No contacts yet"}
            description={
              hasActiveFilters
                ? `Nothing matched${filters.q ? ` “${filters.q}”` : ""}. Try a shorter search, or clear the filters to see all ${data.total} contacts.`
                : "Add your first contact to start building your pipeline. You can import from CSV too."
            }
                    action={hasActiveFilters ? { label: "Clear filters", onClick: clearAllFilters } : undefined}
            actionNode={
              hasActiveFilters ? undefined : (
                <ContactFormDialog
                  workspaceId={workspaceId}
                  organizations={orgs}
                  trigger={<Button>Add your first contact</Button>}
                />
              )
            }
          />
        </DataSurface>
      ) : (
        <DataSurface>
          {/*
            The table and the mobile card list are siblings that each render the
            full row set. Hiding one at the `sm` breakpoint is what stops a phone
            from drawing every contact twice — the bug the unused
            `responsive-table` primitive was written to prevent.
          */}
          <div className="hidden sm:block">
          <Table>
            <DataTableHeader>
              <TableHead className="w-10">
                <Checkbox
                  checked={allSelected}
                  onCheckedChange={toggleAll}
                  aria-label="Select all"
                />
              </TableHead>
              <TableHead>Name</TableHead>
              <TableHead className="hidden sm:table-cell">Phone</TableHead>
              <TableHead className="hidden md:table-cell">Company</TableHead>
              <TableHead className="hidden lg:table-cell">Tags</TableHead>
              <TableHead className="hidden lg:table-cell">Owner</TableHead>
              <TableHead className="hidden sm:table-cell">Created</TableHead>
              <TableHead className="w-10" />
            </DataTableHeader>
            <TableBody>
              {data.items.map((contact, rowIndex) => {
                const owner = contact.owner
                return (
                  <TableRow key={contact.id} className={ROW_CLASS} style={rowEnterStyle(rowIndex)}>
                    <TableCell>
                      <Checkbox
                        checked={selected.has(contact.id)}
                        onCheckedChange={(checked) =>
                          setSelected((prev) => {
                            const next = new Set(prev)
                            if (checked) next.add(contact.id)
                            else next.delete(contact.id)
                            return next
                          })
                        }
                        aria-label={`Select ${fullName(contact.firstName, contact.lastName)}`}
                      />
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2.5">
                        <Avatar className="size-8">
                          <AvatarFallback>
                            {initials(fullName(contact.firstName, contact.lastName))}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <Link
                            href={`/${workspaceSlug}/contacts/${contact.id}`}
                            className="tap-target truncate text-sm font-medium hover:underline"
                          >
                            {fullName(contact.firstName, contact.lastName)}
                          </Link>
                          <p className="truncate text-xs text-muted-foreground">
                            {contact.jobTitle || contact.email || "No email"}
                          </p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">
                      {contact.phone ? (
                        <a
                          href={`tel:${contact.phone}`}
                          onClick={(e) => e.stopPropagation()}
                          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-brand-solid transition-colors"
                        >
                          <Phone className="size-3.5" />
                          {contact.phone}
                        </a>
                      ) : (
                        <span className="text-sm text-muted-foreground/50">—</span>
                      )}
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      {contact.organization ? (
                        <span className="text-sm text-muted-foreground">
                          {contact.organization.name}
                        </span>
                      ) : (
                        <span className="text-sm text-muted-foreground/50">—</span>
                      )}
                    </TableCell>
                    <TableCell className="hidden lg:table-cell">
                      <TagPills tags={contact.tags} max={2} />
                    </TableCell>
                    <TableCell className="hidden lg:table-cell">
                      {owner ? (
                        <div className="flex items-center gap-1.5">
                          <Avatar className="size-6">
                            <AvatarFallback className="text-[10px]">
                              {initials(owner.name)}
                            </AvatarFallback>
                          </Avatar>
                          <span className="text-sm text-muted-foreground">
                            {owner.name}
                          </span>
                        </div>
                      ) : (
                        <span className="text-sm text-muted-foreground/50">Unassigned</span>
                      )}
                    </TableCell>
                    <TableCell className="hidden text-sm text-muted-foreground sm:table-cell">
                      {formatDate(contact.createdAt)}
                    </TableCell>
                    <TableCell>
                      <RowActions>
                        <DropdownMenu>
                          <DropdownMenuTrigger
                            render={
                              <Button variant="ghost" size="icon" className="size-8">
                                <MoreHorizontal />
                                <span className="sr-only">
                                  Actions for {fullName(contact.firstName, contact.lastName)}
                                </span>
                              </Button>
                            }
                          />
                          <DropdownMenuContent align="end">
                            <ContactFormDialog
                              workspaceId={workspaceId}
                              organizations={orgs}
                              contact={contact}
                              trigger={
                                <span className="w-full px-2 py-1.5 text-sm">Edit</span>
                              }
                            />
                            {canDelete && (
                              <DropdownMenuItem
                                variant="destructive"
                                onSelect={() => setPendingDelete(contact)}
                              >
                                Delete
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </RowActions>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
          </div>
          <TableTotalsBar>
            <span className="font-medium">
              <span className="tabular-nums">{data.items.length}</span>{" "}
              <span className="text-muted-foreground">on this page</span>
            </span>
            <Metric label="Total contacts" value={data.total} />
            {selected.size > 0 && <Metric label="Selected" value={selected.size} />}
          </TableTotalsBar>
        </DataSurface>
      )}

      {/* Mobile card list */}
      {data.items.length > 0 && (
        <div className="sm:hidden space-y-2">
          {data.items.map((contact) => (
            <MobileCardRow
              key={contact.id}
              href={`/${workspaceSlug}/contacts/${contact.id}`}
              primary={
                <div className="flex items-center gap-2">
                  <Avatar className="size-7">
                    <AvatarFallback className="text-[10px]">
                      {initials(fullName(contact.firstName, contact.lastName))}
                    </AvatarFallback>
                  </Avatar>
                  <span>{fullName(contact.firstName, contact.lastName)}</span>
                </div>
              }
              secondary={contact.phone ?? contact.email ?? contact.organization?.name ?? "No details"}
              meta={
                <>
                  {contact.tags.slice(0, 2).map(({ tag }) => (
                    <span
                      key={tag.id}
                      className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium"
                    >
                      <span className="size-1.5 rounded-full" style={{ backgroundColor: tag.color }} />
                      {tag.name}
                    </span>
                  ))}
                </>
              }
            />
          ))}
        </div>
      )}

      {/* Pagination */}
      {data.totalPages > 1 && (
        <Pagination>
          <PaginationContent>
            <PaginationItem>
              <PaginationPrevious
                onClick={() => goToPage(Math.max(1, data.page - 1))}
                className={cn(data.page <= 1 && "pointer-events-none opacity-50")}
              />
            </PaginationItem>
            {Array.from({ length: data.totalPages }, (_, i) => i + 1)
              .filter(
                (p) =>
                  p === 1 || p === data.totalPages || Math.abs(p - data.page) <= 1
              )
              .reduce<number[]>((acc, p, idx, arr) => {
                if (idx > 0 && p - arr[idx - 1] > 1) acc.push(-1)
                acc.push(p)
                return acc
              }, [])
              .map((p, idx) =>
                p === -1 ? (
                  <PaginationItem key={`e-${idx}`}>
                    <PaginationEllipsis />
                  </PaginationItem>
                ) : (
                  <PaginationItem key={p}>
                    <PaginationLink
                      isActive={p === data.page}
                      onClick={() => goToPage(p)}
                    >
                      {p}
                    </PaginationLink>
                  </PaginationItem>
                )
              )}
            <PaginationItem>
              <PaginationNext
                onClick={() => goToPage(Math.min(data.totalPages, data.page + 1))}
                className={cn(
                  data.page >= data.totalPages && "pointer-events-none opacity-50"
                )}
              />
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      )}

      {/* Tag dialog */}
      <Dialog open={tagDialogOpen} onOpenChange={setTagDialogOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Tag {selected.size} contacts</DialogTitle>
            <DialogDescription>Pick one or more tags to apply.</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-2">
            {tags.length === 0 && (
              <p className="text-sm text-muted-foreground">
                No tags yet — create tags from a contact&apos;s page.
              </p>
            )}
            {tags.map((tag) => (
              <label
                key={tag.id}
                className="flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm hover:bg-accent"
              >
                <Checkbox
                  checked={selectedTagIds.includes(tag.id)}
                  onCheckedChange={(checked) =>
                    setSelectedTagIds((prev) =>
                      checked
                        ? [...prev, tag.id]
                        : prev.filter((id) => id !== tag.id)
                    )
                  }
                />
                <span
                  className="size-2.5 rounded-full"
                  style={{ backgroundColor: tag.color }}
                />
                {tag.name}
              </label>
            ))}
          </div>
          <DialogFooter>
            <Button
              onClick={onApplyTags}
              disabled={selectedTagIds.length === 0}
            >
              Apply tags
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Assign owner dialog */}
      <Dialog open={assignDialogOpen} onOpenChange={setAssignDialogOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Assign {selected.size} contacts</DialogTitle>
            <DialogDescription>Choose the new owner.</DialogDescription>
          </DialogHeader>
          <Select value={assignOwnerId} onValueChange={(v) => v && setAssignOwnerId(v)}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select an owner" />
            </SelectTrigger>
            <SelectContent>
              {members.map((m) => (
                <SelectItem key={m.user.id} value={m.user.id}>
                  {m.user.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <DialogFooter>
            <Button onClick={onApplyAssign} disabled={!assignOwnerId}>
              Assign
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <AlertDialog open={!!pendingDelete} onOpenChange={(o) => !o && setPendingDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this contact?</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingDelete
                ? `${fullName(pendingDelete.firstName, pendingDelete.lastName)} and all their activity will be permanently removed.`
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

      {/* Import dialog */}
      <ImportContactsDialog
        open={importDialogOpen}
        onOpenChange={setImportDialogOpen}
        workspaceId={workspaceId}
        onImported={() => router.refresh()}
      />
    </div>
  )
}
