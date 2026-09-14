"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { useSession } from "next-auth/react"
import { toast } from "sonner"
import { Check, ChevronsUpDown, LoaderCircle, Plus } from "lucide-react"

import { createWorkspaceAction } from "@/lib/actions/workspaces"
import { Button } from "@/components/ui/button"
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
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"

export type LiteWorkspace = {
  id: string
  slug: string
  name: string
  role: string
}

export function WorkspaceSwitcher({
  active,
  workspaces,
}: {
  active: LiteWorkspace
  workspaces: LiteWorkspace[]
}) {
  const router = useRouter()
  const { update } = useSession()
  const [createOpen, setCreateOpen] = useState(false)
  const [isPending, startTransition] = useTransition()

  function switchTo(ws: LiteWorkspace) {
    if (ws.id === active.id) return
    // Persist the new active workspace in the JWT via session update
    void update({ activeWorkspaceId: ws.id })
    router.push(`/${ws.slug}/contacts`)
    router.refresh()
  }

  function onCreate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const name = String(form.get("name") ?? "")

    startTransition(async () => {
      const result = await createWorkspaceAction(name)
      if (result.error) {
        toast.error(result.error.message)
        return
      }
      toast.success("Workspace created")
      setCreateOpen(false)
      void update({ activeWorkspaceId: result.data.id })
      router.push(`/${result.data.slug}/today`)
      router.refresh()
    })
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              variant="ghost"
              className="h-9 w-full justify-start gap-2 px-2 text-left font-medium hover:bg-accent"
            >
              <span className="flex size-5 shrink-0 items-center justify-center rounded-md bg-primary text-[10px] font-bold text-primary-foreground">
                {active.name.slice(0, 2).toUpperCase()}
              </span>
              <span className="min-w-0 flex-1 truncate">{active.name}</span>
              <ChevronsUpDown className="size-4 shrink-0 text-muted-foreground" />
            </Button>
          }
        />
        <DropdownMenuContent align="start" side="right" className="w-64">
          <DropdownMenuGroup>
            <DropdownMenuLabel>Workspaces</DropdownMenuLabel>
          </DropdownMenuGroup>
          <DropdownMenuGroup>
            {workspaces.map((ws) => (
              <DropdownMenuItem
                key={ws.id}
                onClick={() => switchTo(ws)}
                className="gap-2"
              >
                <span className="flex size-6 shrink-0 items-center justify-center rounded-md bg-muted text-[10px] font-semibold">
                  {ws.name.slice(0, 2).toUpperCase()}
                </span>
                <span className="min-w-0 flex-1 truncate">{ws.name}</span>
                {ws.id === active.id && (
                  <Check className="size-4 text-primary" />
                )}
                <DropdownMenuShortcut className="uppercase text-[10px]">
                  {ws.role}
                </DropdownMenuShortcut>
              </DropdownMenuItem>
            ))}
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={() => setCreateOpen(true)}
            className="gap-2"
          >
            <Plus className="size-4" />
            Create workspace
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Create a workspace</DialogTitle>
            <DialogDescription>
              A fresh workspace with its own contacts, deals, and pipeline. You&apos;ll be the owner.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={onCreate} className="flex flex-col gap-4">
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="name">Workspace name</FieldLabel>
                <Input
                  id="name"
                  name="name"
                  placeholder="Acme Realty"
                  autoFocus
                  required
                />
              </Field>
            </FieldGroup>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setCreateOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending && (
                  <LoaderCircle data-icon="inline-start" className="animate-spin" />
                )}
                Create workspace
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}
