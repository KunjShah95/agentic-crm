"use client"

import { useState } from "react"
import { InventoryGrid } from "./InventoryGrid"
import { UnitDrawer } from "./UnitDrawer"

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

export function InventoryWithDrawer({ units }: { units: Unit[] }) {
  const [selected, setSelected] = useState<Unit | null>(null)

  return (
    <>
      <InventoryGrid units={units} onSelect={(u) => setSelected(u as Unit)} />
      {selected ? (
        <UnitDrawer unit={selected} open={!!selected} onClose={() => setSelected(null)} />
      ) : null}
    </>
  )
}

export default InventoryWithDrawer
