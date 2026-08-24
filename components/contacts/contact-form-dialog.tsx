"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { LoaderCircle, Pencil, Plus } from "lucide-react"

import {
  createContactAction,
  updateContactAction,
} from "@/lib/actions/contacts"
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

export type ContactFormValues = {
  firstName: string
  lastName: string
  email: string
  phone: string
  jobTitle: string
  linkedinUrl: string
  organizationId: string
}

export function ContactFormDialog({
  workspaceId,
  organizations,
  contact,
  trigger,
}: {
  workspaceId: string
  organizations: { id: string; name: string }[]
  contact?: {
    id: string
    firstName: string
    lastName: string
    email: string | null
    phone: string | null
    jobTitle: string | null
    linkedinUrl: string | null
    organizationId: string | null
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
      firstName: String(form.get("firstName") ?? ""),
      lastName: String(form.get("lastName") ?? ""),
      email: String(form.get("email") ?? ""),
      phone: String(form.get("phone") ?? ""),
      jobTitle: String(form.get("jobTitle") ?? ""),
      linkedinUrl: String(form.get("linkedinUrl") ?? ""),
      organizationId: String(form.get("organizationId") ?? ""),
    }

    startTransition(async () => {
      const result = contact
        ? await updateContactAction(workspaceId, contact.id, values)
        : await createContactAction(workspaceId, values)
      if (result.error) {
        toast.error(result.error.message)
        return
      }
      toast.success(contact ? "Contact updated" : "Contact created")
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
              {contact ? <Pencil data-icon="inline-start" /> : <Plus data-icon="inline-start" />}
              {contact ? "Edit" : "Add contact"}
            </Button>
          )
        }
      />
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{contact ? "Edit contact" : "Add a contact"}</DialogTitle>
          <DialogDescription>
            {contact
              ? "Update this contact's details."
              : "Create a new contact in this workspace."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <FieldGroup>
            <div className="grid grid-cols-2 gap-3">
              <Field>
                <FieldLabel htmlFor="firstName">First name</FieldLabel>
                <Input
                  id="firstName"
                  name="firstName"
                  placeholder="Ada"
                  defaultValue={contact?.firstName}
                  required
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="lastName">Last name</FieldLabel>
                <Input
                  id="lastName"
                  name="lastName"
                  placeholder="Lovelace"
                  defaultValue={contact?.lastName}
                />
              </Field>
            </div>
            <Field>
              <FieldLabel htmlFor="email">Email</FieldLabel>
              <Input
                id="email"
                name="email"
                type="email"
                placeholder="ada@company.com"
                defaultValue={contact?.email ?? ""}
              />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field>
                <FieldLabel htmlFor="phone">Phone</FieldLabel>
                <Input
                  id="phone"
                  name="phone"
                  placeholder="+1 555 000 1234"
                  defaultValue={contact?.phone ?? ""}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="jobTitle">Job title</FieldLabel>
                <Input
                  id="jobTitle"
                  name="jobTitle"
                  placeholder="Engineer"
                  defaultValue={contact?.jobTitle ?? ""}
                />
              </Field>
            </div>
            <Field>
              <FieldLabel htmlFor="linkedinUrl">LinkedIn URL</FieldLabel>
              <Input
                id="linkedinUrl"
                name="linkedinUrl"
                placeholder="https://linkedin.com/in/…"
                defaultValue={contact?.linkedinUrl ?? ""}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="organizationId">Company</FieldLabel>
              <Select
                name="organizationId"
                defaultValue={contact?.organizationId ?? ""}
              >
                <SelectTrigger id="organizationId" className="w-full">
                  <SelectValue placeholder="No company" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">No company</SelectItem>
                  {organizations.map((org) => (
                    <SelectItem key={org.id} value={org.id}>
                      {org.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </FieldGroup>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending && (
                <LoaderCircle data-icon="inline-start" className="animate-spin" />
              )}
              {contact ? "Save changes" : "Create contact"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
