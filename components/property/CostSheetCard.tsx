type OtherCharges = Record<string, number> | null | undefined

type Sheet = {
  basePrice: number
  gst: number
  stampDuty: number
  otherCharges?: OtherCharges
  total: number
  currency?: string
}

type CostSheetCardProps =
  | Sheet
  | { sheet: Sheet }

function isSheetProp(props: CostSheetCardProps): props is { sheet: Sheet } {
  return (props as { sheet?: Sheet }).sheet !== undefined
}

export function CostSheetCard(props: CostSheetCardProps) {
  const { basePrice, gst, stampDuty, otherCharges, total, currency = "INR" } = isSheetProp(props) ? props.sheet : (props as Sheet)
  const fmt = (n: number) => n.toLocaleString("en-IN")

  return (
    <div className="rounded-lg border p-4">
      <div className="space-y-2 text-sm">
        <div className="flex justify-between">
          <span className="text-muted-foreground">Base Price</span>
          <span className="font-medium">
            ₹{fmt(basePrice)} {currency}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">GST</span>
          <span className="font-medium">₹{fmt(gst)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Stamp Duty</span>
          <span className="font-medium">₹{fmt(stampDuty)}</span>
        </div>
        {otherCharges &&
          Object.entries(otherCharges).map(([key, val]) => (
            <div key={key} className="flex justify-between">
              <span className="text-muted-foreground">{key}</span>
              <span className="font-medium">₹{fmt(val)}</span>
            </div>
          ))}
        <div className="flex justify-between border-t pt-2 font-semibold">
          <span>Total</span>
          <span>₹{fmt(total)}</span>
        </div>
      </div>
    </div>
  )
}
