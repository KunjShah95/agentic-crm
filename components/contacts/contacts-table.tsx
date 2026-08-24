"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { toast } from "sonner"
import {
  Download,
  MoreHorizontal,
  Search,
  Tag as TagIcon,
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
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
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
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Empty,
  EmptyDescription,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"

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

  // Debounced search → URL
  React.useEffect(() => {
    const timer = setTimeout(() => {
      const params = new URLSearchParams(searchParams.toString())
      if (query.trim()) params.set("q", query.trim())
      else params.delete("q")
      params.delete("page")
      router.replace(`${pathname}?${params.toString()}`)
    }, 350)
    return () => clearTimeout(timer)
  }, [query]) // eslint-disable-line react-hooks/exhaustive-deps

  function updateParam(key: string, value: string | null) {
    const params = new URLSearchParams(searchParams.toString())
    if (value && value !== "all") params.set(key, value)
    else params.delete(key)
    params.delete("page")
    router.replace(`${pathname}?${params.toString()}`)
  }

  function goToPage(page: number) {
    const params = new URLSearchParams(searchParams.toString())
    if (page > 1) params.set("page", String(page))
    else params.delete("page")
    router.replace(`${pathname}?${params.toString()}`)
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
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-56 flex-1">
          <Search className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search contacts…"
            className="pl-8"
          />
        </div>

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

        <Button variant="outline" size="icon" onClick={() => runExport()} disabled={exporting}>
          <Download />
          <span className="sr-only">Export CSV</span>
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

      {/* Bulk action bar */}
      {selected.size > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-accent/50 px-3 py-2">
          <span className="text-sm font-medium">
            {selected.size} selected
          </span>
          <div className="ml-auto flex items-center gap-2">
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
            <Button variant="ghost" size="sm" onClick={() => setSelected(new Set())}>
              Clear
            </Button>
          </div>
        </div>
      )}

      {/* Table */}
      {data.items.length === 0 ? (
        <Empty>
          <EmptyMedia variant="icon">
            <Users />
          </EmptyMedia>
          <EmptyTitle>No contacts found</EmptyTitle>
          <EmptyDescription>
            {filters.q || filters.tagId || filters.organizationId || filters.ownerId
              ? "Try clearing some filters, or add a new contact."
              : "Add your first contact to get started."}
          </EmptyDescription>
          {!filters.q && (
            <ContactFormDialog
              workspaceId={workspaceId}
              organizations={orgs}
              trigger={<Button>Add contact</Button>}
            />
          )}
        </Empty>
      ) : (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="w-10">
                  <Checkbox
                    checked={allSelected}
                    onCheckedChange={toggleAll}
                    aria-label="Select all"
                  />
                </TableHead>
                <TableHead>Name</TableHead>
                <TableHead className="hidden md:table-cell">Company</TableHead>
                <TableHead className="hidden lg:table-cell">Tags</TableHead>
                <TableHead className="hidden lg:table-cell">Owner</TableHead>
                <TableHead className="hidden sm:table-cell">Created</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.items.map((contact) => {
                const owner = contact.owner
                return (
                  <TableRow key={contact.id}>
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
                            className="truncate text-sm font-medium hover:underline"
                          >
                            {fullName(contact.firstName, contact.lastName)}
                          </Link>
                          <p className="truncate text-xs text-muted-foreground">
                            {contact.jobTitle || contact.email || "No email"}
                          </p>
                        </div>
                      </div>
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
                      <div className="flex flex-wrap gap-1">
                        {contact.tags.slice(0, 2).map(({ tag }) => (
                          <Badge
                            key={tag.id}
                            variant="outline"
                            style={{ borderColor: tag.color, color: tag.color }}
                            className="text-[11px]"
                          >
                            {tag.name}
                          </Badge>
                        ))}
                        {contact.tags.length > 2 && (
                          <Badge variant="secondary" className="text-[11px]">
                            +{contact.tags.length - 2}
                          </Badge>
                        )}
                      </div>
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
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
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
    </div>
  )
}
