"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { CalendarDays, LoaderCircle, Plus, StickyNote } from "lucide-react"

import { createActivityAction } from "@/lib/actions/activities"
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
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

const TYPES = [
  { value: "NOTE", label: "Note" },
  { value: "EMAIL", label: "Email" },
  { value: "CALL", label: "Call" },
  { value: "MEETING", label: "Meeting" },
  { value: "TASK", label: "Task" },
]

export function ActivityComposer({
  workspaceId,
  contactId,
  dealId,
  members,
}: {
  workspaceId: string
  contactId?: string
  dealId?: string
  members?: { userId: string; user: { id: string; name: string } }[]
}) {
  const router = useRouter()
  const [quick, setQuick] = React.useState("")
  const [isQuickPending, startQuick] = React.useTransition()
  const [isPending, startPending] = React.useTransition()
  const [open, setOpen] = React.useState(false)
  const [type, setType] = React.useState("NOTE")
  const [assigneeId, setAssigneeId] = React.useState<string>("")

  async function submit(values: {
    type: string
    body: string
    scheduledAt?: string
    assigneeId?: string
  }) {
    const result = await createActivityAction(workspaceId, {
      type: values.type,
      contactId: contactId ?? "",
      dealId: dealId ?? "",
      body: values.body,
      scheduledAt: values.scheduledAt || null,
      assigneeId: values.assigneeId || "",
    })
    if (result.error) {
      toast.error(result.error.message)
      return false
    }
    toast.success("Activity logged")
    router.refresh()
    return true
  }

  function onQuickNote(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const body = quick.trim()
    if (!body) return
    setQuick("")
    startQuick(async () => {
      await submit({ type: "NOTE", body })
    })
  }

  function onDialogSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    startPending(async () => {
      const ok2 = await submit({
        type: type,
        body: String(form.get("body") ?? ""),
        scheduledAt: String(form.get("scheduledAt") ?? "") || undefined,
        assigneeId: assigneeId || undefined,
      })
      if (ok2) setOpen(false)
    })
  }

  return (
    <div className="flex flex-col gap-2">
      <form onSubmit={onQuickNote} className="flex flex-col gap-2">
        <Textarea
          value={quick}
          onChange={(e) => setQuick(e.target.value)}
          placeholder="Add a quick note…"
          className="min-h-16 resize-none"
        />
        <div className="flex items-center justify-between gap-2">
          <Button type="submit" size="sm" disabled={isQuickPending || !quick.trim()}>
            {isQuickPending ? (
              <LoaderCircle data-icon="inline-start" className="animate-spin" />
            ) : (
              <StickyNote data-icon="inline-start" />
            )}
            Add note
          </Button>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger
              render={
                <Button type="button" variant="outline" size="sm">
                  <Plus data-icon="inline-start" />
                  Log activity
                </Button>
              }
            />
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Log an activity</DialogTitle>
                <DialogDescription>
                  Track emails, calls, meetings, and tasks against this record.
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={onDialogSubmit} className="flex flex-col gap-4">
                <FieldGroup>
                  <Field>
                    <FieldLabel>Type</FieldLabel>
                    <Select value={type} onValueChange={(v) => v && setType(v)}>
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {TYPES.map((t) => (
                          <SelectItem key={t.value} value={t.value}>
                            {t.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="body">Details</FieldLabel>
                    <Textarea
                      id="body"
                      name="body"
                      placeholder={type === "TASK" ? "What needs to be done?" : "What happened?"}
                      className="min-h-24"
                      required
                    />
                  </Field>
                  {type === "TASK" && (
                    <>
                      <Field>
                        <FieldLabel htmlFor="scheduledAt">
                          <span className="inline-flex items-center gap-1">
                            <CalendarDays className="size-3.5" />
                            Due date
                          </span>
                        </FieldLabel>
                        <Input
                          id="scheduledAt"
                          name="scheduledAt"
                          type="date"
                        />
                      </Field>
                      {members && members.length > 0 && (
                        <Field>
                          <FieldLabel>Assignee</FieldLabel>
                          <Select value={assigneeId} onValueChange={(v) => v && setAssigneeId(v)}>
                            <SelectTrigger className="w-full">
                              <SelectValue placeholder="Assign to…" />
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
                      )}
                    </>
                  )}
                </FieldGroup>
                <DialogFooter>
                  <Button type="submit" disabled={isPending}>
                    {isPending && (
                      <LoaderCircle data-icon="inline-start" className="animate-spin" />
                    )}
                    Log activity
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </form>
    </div>
  )
}
