"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { RE_STAGES } from "@/modules/booking/stages"
import { holdUnit, confirmBooking } from "@/modules/booking/actions"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

type Unit = { id: string; unitNo: string; status: string; price: number | null }
type Plan = { id: string; name: string }
type Deal = {
  id: string
  title: string
  bookingStage: string | null
  value: number | null
  contact: { firstName: string; lastName: string } | null
  unit: { id: string; unitNo: string; status: string; price: number | null } | null
  _count: { payments: number }
}

const inr = (n?: number | null) => (n == null ? "—" : `₹${n.toLocaleString("en-IN")}`)

export function BookingBoard({
  workspaceId,
  deals,
  units,
  plans,
}: {
  workspaceId: string
  deals: Deal[]
  units: Unit[]
  plans: Plan[]
}) {
  const byStage = (stage: string) => deals.filter((d) => (d.bookingStage ?? "INQUIRY") === stage)

  return (
    <div className="flex gap-3 overflow-x-auto pb-4">
      {RE_STAGES.map((stage) => (
        <div key={stage} className="w-64 shrink-0">
          <div className="mb-2 flex items-center justify-between px-1">
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{stage}</span>
            <span className="text-xs text-muted-foreground">{byStage(stage).length}</span>
          </div>
          <div className="flex flex-col gap-2">
            {byStage(stage).map((d) => (
              <div key={d.id} className="rounded-lg border bg-card p-3 text-sm shadow-sm">
                <div className="font-medium">{d.title}</div>
                <div className="text-xs text-muted-foreground">
                  {d.contact ? `${d.contact.firstName} ${d.contact.lastName}` : "No contact"}
                </div>
                <div className="mt-1 text-xs text-muted-foreground">
                  {d.unit ? `Unit ${d.unit.unitNo} · ${inr(d.unit.price)}` : "No unit"}
                  {d._count.payments > 0 ? ` · ${d._count.payments} milestones` : ""}
                </div>
                <div className="mt-2">
                  <BookingWizard workspaceId={workspaceId} deal={d} units={units} plans={plans} />
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

function BookingWizard({
  workspaceId,
  deal,
  units,
  plans,
}: {
  workspaceId: string
  deal: Deal
  units: Unit[]
  plans: Plan[]
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [unitId, setUnitId] = useState(deal.unit?.id ?? "")
  const [planId, setPlanId] = useState("")
  const [pending, start] = useTransition()

  const options = deal.unit ? [deal.unit as Unit, ...units.filter((u) => u.id !== deal.unit!.id)] : units

  function run(kind: "hold" | "book") {
    if (!unitId) {
      toast.error("Pick a unit first")
      return
    }
    start(async () => {
      try {
        if (kind === "hold") {
          await holdUnit({ workspaceId, dealId: deal.id, unitId })
          toast.success("Unit held (48h)")
        } else {
          const r = await confirmBooking({ workspaceId, dealId: deal.id, unitId, paymentPlanId: planId || undefined })
          toast.success(`Booked — ${r.milestones} milestones${r.demandDocId ? ", demand letter #1 ready" : ""}`)
        }
        setOpen(false)
        router.refresh()
      } catch (e) {
        toast.error((e as Error).message)
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button size="sm" variant="outline" className="w-full">
            Booking wizard
          </Button>
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Booking · {deal.title}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label>Unit</Label>
            <Select value={unitId} onValueChange={(v) => setUnitId(v ?? "")}>
              <SelectTrigger>
                <SelectValue placeholder="Select a unit" />
              </SelectTrigger>
              <SelectContent>
                {options.map((u) => (
                  <SelectItem key={u.id} value={u.id}>
                    {u.unitNo} · {inr(u.price)} · {u.status}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Payment plan (optional)</Label>
            <Select value={planId} onValueChange={(v) => setPlanId(v ?? "")}>
              <SelectTrigger>
                <SelectValue placeholder="Default 8-stage CLP" />
              </SelectTrigger>
              <SelectContent>
                {plans.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter className="gap-2">
          <Button variant="secondary" disabled={pending} onClick={() => run("hold")}>
            Hold unit
          </Button>
          <Button disabled={pending} onClick={() => run("book")}>
            Confirm booking
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
