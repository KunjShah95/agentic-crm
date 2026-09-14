"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Plus } from "lucide-react"

import { createActivityAction } from "@/lib/actions/activities"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"

export function NewTaskDialog({ workspaceId }: { workspaceId: string }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [body, setBody] = useState("")
  const [scheduledAt, setScheduledAt] = useState("")
  const [pending, setPending] = useState(false)

  async function submit() {
    if (!body.trim()) {
      toast.error("Add a task description.")
      return
    }
    setPending(true)
    const result = await createActivityAction(workspaceId, {
      type: "TASK",
      body: body.trim(),
      scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
    })
    setPending(false)
    if (result.error) {
      toast.error(result.error.message)
      return
    }
    toast.success("Task created ✨")
    setBody("")
    setScheduledAt("")
    setOpen(false)
    router.refresh()
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button size="sm" className="gap-1.5">
            <Plus className="size-4" />
            New task
          </Button>
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New task</DialogTitle>
          <DialogDescription>Assigned to you. Add a due date if it matters.</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4 py-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="task-body">Task</Label>
            <Input
              id="task-body"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Follow up with…"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter" && !pending) submit()
              }}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="task-due">Due date (optional)</Label>
            <Input
              id="task-due"
              type="datetime-local"
              value={scheduledAt}
              onChange={(e) => setScheduledAt(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={pending}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={pending}>
            {pending ? "Creating…" : "Create task"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
