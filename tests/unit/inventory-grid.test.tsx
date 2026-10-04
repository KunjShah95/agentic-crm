import { render, screen } from "@testing-library/react"
import InventoryGrid from "@/components/property/InventoryGrid"
import { describe, it, expect } from "vitest"

describe("InventoryGrid", () => {
  it("renders units with status badges", () => {
    /* No `as any`. The unit's `status` and `config` are declared as `string` on
       `InventoryGrid`'s prop type, so the object literal above typechecked without
       a cast — meaning the cast was hiding nothing about this fixture, only
       removing the compiler's ability to complain if `InventoryGrid` later
       required a field this test does not provide. */
    render(
      <InventoryGrid
        units={[{ id: "1", unitNo: "A-101", status: "AVAILABLE", price: 5000000, config: "BHK2" }]}
      />,
    )
    expect(screen.getByText("A-101")).toBeInTheDocument()
  })
})
