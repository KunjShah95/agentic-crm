"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import {
  Building2,
  MoreHorizontal,
  Search,
  Trash2,
} from "lucide-react"

import { deleteOrganizationAction } from "@/lib/actions/organizations"
import { OrgFormDialog } from "@/components/organizations/org-form-dialog"
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
import { Input } from "@/components/ui/input"
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

type OrgRow = {
  id: string
  name: string
  domain: string | null
  industry: string | null
  website: string | null
  size: string | null
  _count: { contacts: number; deals: number }
}

export function OrgsTable({
  workspaceSlug,
  workspaceId,
  orgs,
}: {
  workspaceSlug: string
  workspaceId: string
  orgs: OrgRow[]
}) {
  const router = useRouter()
  const [query, setQuery] = React.useState("")
  const [pendingDelete, setPendingDelete] = React.useState<OrgRow | null>(null)

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return orgs
    return orgs.filter(
      (org) =>
        org.name.toLowerCase().includes(q) ||
        org.domain?.toLowerCase().includes(q) ||
        org.industry?.toLowerCase().includes(q)
    )
  }, [orgs, query])

  async function onDelete(org: OrgRow) {
    const result = await deleteOrganizationAction(workspaceId, org.id)
    if (result.error) {
      toast.error(result.error.message)
      return
    }
    toast.success("Organization deleted")
    setPendingDelete(null)
    router.refresh()
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="relative max-w-sm">
        <Search className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search companies…"
          className="pl-8"
        />
      </div>

      {filtered.length === 0 ? (
        <Empty>
          <EmptyMedia variant="icon">
            <Building2 />
          </EmptyMedia>
          <EmptyTitle>No companies found</EmptyTitle>
          <EmptyDescription>
            {query ? "Try a different search." : "Add your first company."}
          </EmptyDescription>
        </Empty>
      ) : (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Company</TableHead>
                <TableHead className="hidden md:table-cell">Domain</TableHead>
                <TableHead className="hidden lg:table-cell">Industry</TableHead>
                <TableHead className="text-right">Contacts</TableHead>
                <TableHead className="text-right">Deals</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((org) => (
                <TableRow key={org.id}>
                  <TableCell>
                    <div className="flex items-center gap-2.5">
                      <span className="flex size-8 items-center justify-center rounded-md bg-muted">
                        <Building2 className="size-4 text-muted-foreground" />
                      </span>
                      <div className="min-w-0">
                        <Link
                          href={`/${workspaceSlug}/organizations/${org.id}`}
                          className="text-sm font-medium hover:underline"
                        >
                          {org.name}
                        </Link>
                        {org.size && (
                          <p className="text-xs text-muted-foreground">
                            {org.size} employees
                          </p>
                        )}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
                    <span className="text-sm text-muted-foreground">
                      {org.domain ?? "—"}
                    </span>
                  </TableCell>
                  <TableCell className="hidden lg:table-cell">
                    <span className="text-sm text-muted-foreground">
                      {org.industry ?? "—"}
                    </span>
                  </TableCell>
                  <TableCell className="text-right text-sm">
                    {org._count.contacts}
                  </TableCell>
                  <TableCell className="text-right text-sm">
                    {org._count.deals}
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
                        <OrgFormDialog
                          workspaceId={workspaceId}
                          org={{
                            id: org.id,
                            name: org.name,
                            domain: org.domain,
                            industry: org.industry,
                            size: org.size,
                            website: org.website,
                          }}
                          trigger={
                            <span className="w-full px-2 py-1.5 text-sm">Edit</span>
                          }
                        />
                        <DropdownMenuItem
                          variant="destructive"
                          onSelect={() => setPendingDelete(org)}
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
        </div>
      )}

      <AlertDialog open={!!pendingDelete} onOpenChange={(o) => !o && setPendingDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this company?</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingDelete?.name} will be removed. Linked contacts are kept
              but unlinked.
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
