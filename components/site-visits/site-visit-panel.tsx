"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { MapPin } from "lucide-react"
import { scheduleVisit, checkIn } from "@/modules/siteVisits/actions"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

type Contact = { id: string; firstName: string; lastName: string }

export function ScheduleVisitDialog({ workspaceId, contacts }: { workspaceId: string; contacts: Contact[] }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [leadId, setLeadId] = useState("")
  const [pending, start] = useTransition()

  function submit(form: FormData) {
    if (!leadId) {
      toast.error("Pick a lead")
      return
    }
    const scheduledAt = String(form.get("scheduledAt") ?? "")
    if (!scheduledAt) {
      toast.error("Pick a date/time")
      return
    }
    start(async () => {
      try {
        await scheduleVisit({
          workspaceId,
          data: { leadId, scheduledAt: new Date(scheduledAt), notes: String(form.get("notes") ?? "") },
        })
        toast.success("Site visit scheduled")
        setOpen(false)
        router.refresh()
      } catch (e) {
        toast.error((e as Error).message)
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="sm">Schedule visit</Button>} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Schedule site visit</DialogTitle>
        </DialogHeader>
        <form action={submit} className="space-y-3">
          <div className="space-y-1">
            <Label>Lead</Label>
            <Select value={leadId} onValueChange={(v) => setLeadId(v ?? "")}>
              <SelectTrigger>
                <SelectValue placeholder="Select lead" />
              </SelectTrigger>
              <SelectContent>
                {contacts.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.firstName} {c.lastName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="sv-when">When</Label>
            <Input id="sv-when" name="scheduledAt" type="datetime-local" required />
          </div>
          <div className="space-y-1">
            <Label htmlFor="sv-notes">Notes</Label>
            <Textarea id="sv-notes" name="notes" placeholder="Unit A-1201, bring cost sheet" />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={pending}>
              Schedule
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export function CheckInButton({ workspaceId, siteVisitId }: { workspaceId: string; siteVisitId: string }) {
  const router = useRouter()
  const [pending, start] = useTransition()

  function doCheckIn() {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      toast.error("Geolocation unavailable")
      return
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        start(async () => {
          try {
            const r = await checkIn({
              workspaceId,
              data: { siteVisitId, lat: pos.coords.latitude, lng: pos.coords.longitude },
            })
            toast.success(r.verified ? "Checked in" : "Checked in (outside geofence)")
            router.refresh()
          } catch (e) {
            toast.error((e as Error).message)
          }
        })
      },
      () => toast.error("Location permission denied")
    )
  }

  return (
    <Button size="sm" variant="outline" disabled={pending} onClick={doCheckIn}>
      <MapPin className="size-4" /> Check in
    </Button>
  )
}
