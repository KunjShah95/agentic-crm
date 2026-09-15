"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { ChevronDown, ChevronUp, LoaderCircle, Pencil, Plus } from "lucide-react"

import { createDealAction, updateDealAction } from "@/lib/actions/deals"
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

const CURRENCIES = ["INR", "USD", "EUR", "GBP", "CAD", "AUD", "JPY", "BRL"]

const DEAL_TYPE_OPTIONS = [
  { value: "PLOT", label: "Land / Plot" },
  { value: "VILLA", label: "Villa" },
  { value: "BUNGALOW", label: "Bungalow" },
  { value: "FLAT", label: "Flat (1–4 BHK)" },
  { value: "SHOP", label: "Shop" },
  { value: "COMMERCIAL", label: "Commercial" },
  { value: "OFFICE", label: "Office" },
  { value: "CORPORATE_HOUSE", label: "Corporate house" },
]

const URGENCY_OPTIONS = [
  { value: "NONE", label: "None" },
  { value: "LOW", label: "Low" },
  { value: "NORMAL", label: "Normal" },
  { value: "HIGH", label: "High" },
  { value: "DISTRESS", label: "Distress (must move)" },
]

export function DealFormDialog({
  workspaceId,
  stages,
  contacts,
  organizations,
  members,
  deal,
  trigger,
}: {
  workspaceId: string
  stages: { id: string; name: string; color: string }[]
  contacts: { id: string; firstName: string; lastName: string }[]
  organizations: { id: string; name: string }[]
  members: { userId: string; user: { id: string; name: string } }[]
  deal?: {
    id: string
    title: string
    stageId: string
    contactId: string | null
    organizationId: string | null
    value: number | null
    currency: string
    probability: number | null
    expectedCloseDate: Date | null
    ownerId: string | null
    dealType?: string | null
    urgency?: string | null
  }
  trigger?: React.ReactElement
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [showAdvanced, setShowAdvanced] = useState(!!deal)

  function toDateInput(d: Date | null | undefined) {
    return d ? new Date(d).toISOString().slice(0, 10) : ""
  }

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const values = {
      title: String(form.get("title") ?? ""),
      stageId: String(form.get("stageId") ?? ""),
      contactId: String(form.get("contactId") ?? ""),
      organizationId: String(form.get("organizationId") ?? ""),
      value: String(form.get("value") ?? ""),
      currency: String(form.get("currency") ?? "INR"),
      probability: String(form.get("probability") ?? ""),
      expectedCloseDate: String(form.get("expectedCloseDate") ?? "") || null,
      ownerId: String(form.get("ownerId") ?? ""),
      dealType: String(form.get("dealType") ?? ""),
      urgency: String(form.get("urgency") ?? "NORMAL"),
    }

    startTransition(async () => {
      const result = deal
        ? await updateDealAction(workspaceId, deal.id, values)
        : await createDealAction(workspaceId, values)
      if (result.error) {
        toast.error(result.error.message)
        return
      }
      toast.success(deal ? "Deal updated" : "Deal created")
      setOpen(false)
      setShowAdvanced(!!deal)
      router.refresh()
    })
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setShowAdvanced(!!deal) }}>
      <DialogTrigger
        render={
          trigger ?? (
            <Button size="sm">
              {deal ? <Pencil data-icon="inline-start" /> : <Plus data-icon="inline-start" />}
              {deal ? "Edit" : "New deal"}
            </Button>
          )
        }
      />
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{deal ? "Edit deal" : "Add a new deal"}</DialogTitle>
          <DialogDescription>
            {deal ? "Update deal details below." : "Give it a name, pick a stage, and add a value. You can fill in more details later."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="title">Deal name</FieldLabel>
              <Input
                id="title"
                name="title"
                placeholder="e.g. Skyline Residences — 3BHK A-1204"
                defaultValue={deal?.title}
                required
              />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field>
                <FieldLabel>Stage</FieldLabel>
                <Select name="stageId" defaultValue={deal?.stageId}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select stage">
                      {deal?.stageId
                        ? stages.find((stage) => stage.id === deal.stageId)?.name
                        : undefined}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {stages.map((stage) => (
                      <SelectItem key={stage.id} value={stage.id}>
                        {stage.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field>
                <FieldLabel htmlFor="value">Value</FieldLabel>
                <Input
                  id="value"
                  name="value"
                  type="number"
                  min={0}
                  step="any"
                  placeholder="e.g. 12000000"
                  defaultValue={deal?.value?.toString() ?? ""}
                />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field>
                <FieldLabel>Contact</FieldLabel>
                <Select name="contactId" defaultValue={deal?.contactId ?? ""}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select contact" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">No contact</SelectItem>
                    {contacts.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.firstName} {c.lastName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field>
                <FieldLabel>Company</FieldLabel>
                <Select
                  name="organizationId"
                  defaultValue={deal?.organizationId ?? ""}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select company" />
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
            </div>

            {/* Advanced section toggle */}
            {!deal && (
              <button
                type="button"
                onClick={() => setShowAdvanced((s) => !s)}
                className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors mt-1"
              >
                {showAdvanced ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
                {showAdvanced ? "Less options" : "More options"}
              </button>
            )}

            {/* Advanced fields - shown when expanded or when editing */}
            {showAdvanced && (
              <div className="flex flex-col gap-3 pt-2 border-t border-border/50">
                <div className="grid grid-cols-2 gap-3">
                  <Field>
                    <FieldLabel>Currency</FieldLabel>
                    <Select name="currency" defaultValue={deal?.currency ?? "INR"}>
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {CURRENCIES.map((c) => (
                          <SelectItem key={c} value={c}>
                            {c}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="probability">Win chance (%)</FieldLabel>
                    <Input
                      id="probability"
                      name="probability"
                      type="number"
                      min={0}
                      max={100}
                      placeholder="e.g. 75"
                      defaultValue={deal?.probability?.toString() ?? ""}
                    />
                  </Field>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Field>
                    <FieldLabel htmlFor="expectedCloseDate">Expected close</FieldLabel>
                    <Input
                      id="expectedCloseDate"
                      name="expectedCloseDate"
                      type="date"
                      defaultValue={toDateInput(deal?.expectedCloseDate)}
                    />
                  </Field>
                  <Field>
                    <FieldLabel>Owner</FieldLabel>
                    <Select name="ownerId" defaultValue={deal?.ownerId ?? ""}>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="You" />
                      </SelectTrigger>
                      <SelectContent>
                        {members.map((m) => (
                          <SelectItem key={m.user.id} value={m.user.id}>
                            {m.user.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Field>
                    <FieldLabel>Deal type</FieldLabel>
                    <Select name="dealType" defaultValue={deal?.dealType ?? ""}>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Auto (from unit)" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">Auto (from unit)</SelectItem>
                        {DEAL_TYPE_OPTIONS.map((t) => (
                          <SelectItem key={t.value} value={t.value}>
                            {t.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field>
                    <FieldLabel>Urgency</FieldLabel>
                    <Select name="urgency" defaultValue={deal?.urgency ?? "NORMAL"}>
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {URGENCY_OPTIONS.map((u) => (
                          <SelectItem key={u.value} value={u.value}>
                            {u.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                </div>
              </div>
            )}
          </FieldGroup>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending && (
                <LoaderCircle data-icon="inline-start" className="animate-spin" />
              )}
              {deal ? "Save changes" : "Create deal"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
