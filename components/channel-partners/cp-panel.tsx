"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { onboardCp, assignCommission } from "@/modules/channelPartners/actions"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
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

type Cp = { id: string; name: string }
type Deal = { id: string; title: string }

export function CpToolbar({ workspaceId, cps, deals }: { workspaceId: string; cps: Cp[]; deals: Deal[] }) {
  return (
    <div className="flex gap-2">
      <OnboardCpDialog workspaceId={workspaceId} />
      <AssignCommissionDialog workspaceId={workspaceId} cps={cps} deals={deals} />
    </div>
  )
}

function OnboardCpDialog({ workspaceId }: { workspaceId: string }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [pending, start] = useTransition()

  function submit(form: FormData) {
    start(async () => {
      try {
        await onboardCp({
          workspaceId,
          data: {
            name: String(form.get("name") ?? ""),
            reraNo: String(form.get("reraNo") ?? ""),
            brokerage: form.get("brokerage") ? Number(form.get("brokerage")) : undefined,
          },
        })
        toast.success("Channel partner onboarded")
        setOpen(false)
        router.refresh()
      } catch (e) {
        toast.error((e as Error).message)
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="sm">Onboard CP</Button>} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Onboard channel partner</DialogTitle>
        </DialogHeader>
        <form action={submit} className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="cp-name">Name</Label>
            <Input id="cp-name" name="name" required placeholder="Acme Realtors" />
          </div>
          <div className="space-y-1">
            <Label htmlFor="cp-rera">RERA no.</Label>
            <Input id="cp-rera" name="reraNo" placeholder="RERA-GJ-…" />
          </div>
          <div className="space-y-1">
            <Label htmlFor="cp-brokerage">Brokerage %</Label>
            <Input id="cp-brokerage" name="brokerage" type="number" step="0.1" placeholder="2" />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={pending}>
              Save
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function AssignCommissionDialog({ workspaceId, cps, deals }: { workspaceId: string; cps: Cp[]; deals: Deal[] }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [cpId, setCpId] = useState("")
  const [dealId, setDealId] = useState("")
  const [pending, start] = useTransition()

  function submit(form: FormData) {
    if (!cpId || !dealId) {
      toast.error("Pick a CP and a deal")
      return
    }
    const pct = form.get("pct") ? Number(form.get("pct")) : undefined
    const amount = form.get("amount") ? Number(form.get("amount")) : undefined
    start(async () => {
      try {
        const cr = await assignCommission({ workspaceId, data: { dealId, cpId, pct, amount } })
        toast.success(`Commission ₹${(cr.amount ?? 0).toLocaleString("en-IN")} assigned`)
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
          <Button size="sm" variant="outline">
            Assign commission
          </Button>
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Assign commission</DialogTitle>
        </DialogHeader>
        <form action={submit} className="space-y-3">
          <div className="space-y-1">
            <Label>Channel partner</Label>
            <Select value={cpId} onValueChange={(v) => setCpId(v ?? "")}>
              <SelectTrigger>
                <SelectValue placeholder="Select CP" />
              </SelectTrigger>
              <SelectContent>
                {cps.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Deal</Label>
            <Select value={dealId} onValueChange={(v) => setDealId(v ?? "")}>
              <SelectTrigger>
                <SelectValue placeholder="Select deal" />
              </SelectTrigger>
              <SelectContent>
                {deals.map((d) => (
                  <SelectItem key={d.id} value={d.id}>
                    {d.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex gap-2">
            <div className="flex-1 space-y-1">
              <Label htmlFor="c-pct">Percent</Label>
              <Input id="c-pct" name="pct" type="number" step="0.1" placeholder="2" />
            </div>
            <div className="flex-1 space-y-1">
              <Label htmlFor="c-amount">Or fixed ₹</Label>
              <Input id="c-amount" name="amount" type="number" placeholder="150000" />
            </div>
          </div>
          <DialogFooter>
            <Button type="submit" disabled={pending}>
              Assign
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
