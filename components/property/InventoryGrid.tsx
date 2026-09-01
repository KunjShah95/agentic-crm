"use client"

export const STATUS_COLOR: Record<string, string> = {
  AVAILABLE: "bg-green-100 text-green-800",
  HOLD: "bg-yellow-100 text-yellow-800",
  BOOKED: "bg-blue-100 text-blue-800",
  SOLD: "bg-red-100 text-red-800",
}

type Unit = {
  id: string
  unitNo: string
  config: string
  price?: number | null
  status: string
}

export function InventoryGrid({
  units,
  onSelect,
}: {
  units: Unit[]
  onSelect?: (unit: Unit) => void
}) {
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-6">
      {units.map((unit) => (
        <button
          key={unit.id}
          type="button"
          onClick={() => onSelect?.(unit)}
          className="flex flex-col gap-1 rounded-lg border p-3 text-left transition hover:border-primary hover:shadow-sm"
        >
          <span className="text-sm font-semibold">{unit.unitNo}</span>
          <span className="text-xs text-muted-foreground">
            {unit.config} · ₹{unit.price != null ? unit.price.toLocaleString("en-IN") : "—"}
          </span>
          <span
            className={`inline-flex w-fit rounded px-1.5 py-0.5 text-[10px] font-medium ${STATUS_COLOR[unit.status] ?? "bg-gray-100 text-gray-700"}`}
          >
            {unit.status}
          </span>
        </button>
      ))}
    </div>
  )
}

export default InventoryGrid
