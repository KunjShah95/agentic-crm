"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { LoaderCircle, Pencil, Plus } from "lucide-react"

import {
  createOrganizationAction,
  updateOrganizationAction,
} from "@/lib/actions/organizations"
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

const SIZES = ["1-10", "11-50", "51-200", "201-500", "501-1000", "1000+"]

export function OrgFormDialog({
  workspaceId,
  org,
  trigger,
}: {
  workspaceId: string
  org?: {
    id: string
    name: string
    domain: string | null
    industry: string | null
    size: string | null
    website: string | null
  }
  trigger?: React.ReactElement
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const values = {
      name: String(form.get("name") ?? ""),
      domain: String(form.get("domain") ?? ""),
      industry: String(form.get("industry") ?? ""),
      size: String(form.get("size") ?? ""),
      website: String(form.get("website") ?? ""),
    }

    startTransition(async () => {
      const result = org
        ? await updateOrganizationAction(workspaceId, org.id, values)
        : await createOrganizationAction(workspaceId, values)
      if (result.error) {
        toast.error(result.error.message)
        return
      }
      toast.success(org ? "Organization updated" : "Organization created")
      setOpen(false)
      router.refresh()
    })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          trigger ?? (
            <Button size="sm">
              {org ? <Pencil data-icon="inline-start" /> : <Plus data-icon="inline-start" />}
              {org ? "Edit" : "Add company"}
            </Button>
          )
        }
      />
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{org ? "Edit company" : "Add a company"}</DialogTitle>
          <DialogDescription>
            Track the organizations your contacts belong to.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="name">Company name</FieldLabel>
              <Input
                id="name"
                name="name"
                placeholder="Acme Inc."
                defaultValue={org?.name}
                required
              />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field>
                <FieldLabel htmlFor="domain">Email domain</FieldLabel>
                <Input
                  id="domain"
                  name="domain"
                  placeholder="acme.com"
                  defaultValue={org?.domain ?? ""}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="industry">Industry</FieldLabel>
                <Input
                  id="industry"
                  name="industry"
                  placeholder="Software"
                  defaultValue={org?.industry ?? ""}
                />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field>
                <FieldLabel>Company size</FieldLabel>
                <Select name="size" defaultValue={org?.size ?? ""}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select size" />
                  </SelectTrigger>
                  <SelectContent>
                    {SIZES.map((s) => (
                      <SelectItem key={s} value={s}>
                        {s} employees
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field>
                <FieldLabel htmlFor="website">Website</FieldLabel>
                <Input
                  id="website"
                  name="website"
                  placeholder="https://acme.com"
                  defaultValue={org?.website ?? ""}
                />
              </Field>
            </div>
          </FieldGroup>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending && (
                <LoaderCircle data-icon="inline-start" className="animate-spin" />
              )}
              {org ? "Save changes" : "Create company"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
