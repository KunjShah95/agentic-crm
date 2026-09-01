import { render, screen } from "@testing-library/react"
import InventoryGrid from "@/components/property/InventoryGrid"
import { describe, it, expect } from "vitest"
describe("InventoryGrid", () => {
  it("renders units with status badges", () => {
    render(<InventoryGrid units={[{ id: "1", unitNo: "A-101", status: "AVAILABLE", price: 5000000, config: "BHK2" } as any]} />)
    expect(screen.getByText("A-101")).toBeInTheDocument()
  })
})
