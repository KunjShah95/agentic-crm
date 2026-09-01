"use client"

import { CostSheetCard } from "./CostSheetCard"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet"
import { Button, buttonVariants } from "@/components/ui/button"

type Unit = {
  id: string
  unitNo: string
  config: string
  price?: number | null
  status: string
  area?: number | null
  carpetArea?: number | null
  facing?: string | null
}

type SheetData = {
  basePrice: number
  gst: number
  stampDuty: number
  total: number
  otherCharges?: Record<string, number> | null
  currency?: string
}

export function UnitDrawer({
  unit,
  sheet,
  onClose,
  open = true,
}: {
  unit: Unit | null
  sheet?: SheetData | null
  onClose?: () => void
  open?: boolean
}) {
  if (!unit) return null

  const priceText = unit.price != null ? `₹${unit.price.toLocaleString("en-IN")}` : "—"

  const whatsappText = encodeURIComponent(
    `Hi, enquiry for unit ${unit.unitNo} (${unit.config}) - Price ${priceText} - Status ${unit.status}`
  )
  const whatsappUrl = `https://wa.me/?text=${whatsappText}`

  return (
    <Sheet open={open} onOpenChange={(v) => { if (!v) onClose?.() }}>
      <SheetContent side="right" className="sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{unit.unitNo}</SheetTitle>
          <SheetDescription>
            {unit.config} · {priceText} · {unit.status}
          </SheetDescription>
        </SheetHeader>
        <div className="px-4 space-y-4 pb-4">
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <div className="text-xs text-muted-foreground">Unit No</div>
              <div className="font-medium">{unit.unitNo}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Config</div>
              <div className="font-medium">{unit.config}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Price</div>
              <div className="font-medium">{priceText}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Status</div>
              <div className="font-medium">{unit.status}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Area</div>
              <div className="font-medium">{unit.area ?? unit.carpetArea ?? "—"}{unit.area || unit.carpetArea ? " sqft" : ""}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Facing</div>
              <div className="font-medium">{unit.facing ?? "—"}</div>
            </div>
          </div>

          {sheet ? (
            <div className="space-y-2">
              <h4 className="text-sm font-semibold">Cost Sheet</h4>
              <CostSheetCard sheet={sheet} />
            </div>
          ) : null}

          <div className="flex gap-2">
            <a
              href={whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={buttonVariants({ variant: "default" }) + " flex-1"}
            >
              Share on WhatsApp
            </a>
            {onClose ? (
              <Button variant="outline" onClick={onClose}>
                Close
              </Button>
            ) : null}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}

export default UnitDrawer
