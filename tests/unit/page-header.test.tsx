import { render, screen } from "@testing-library/react"
import { describe, it, expect } from "vitest"
import { PageHeader, Stat } from "@/components/shell/page-header"

describe("PageHeader", () => {
  it("renders the title as a level-one heading", () => {
    render(<PageHeader title="Deals" description="14 open opportunities" />)
    const h1 = screen.getByRole("heading", { level: 1 })
    expect(h1).toHaveTextContent("Deals")
    expect(h1.className).toContain("font-display")
  })

  it("uses the sanctioned radius on the outer container", () => {
    const { container } = render(<PageHeader title="Deals" />)
    const root = container.firstElementChild
    expect(root).toHaveClass("rounded-md")
    expect(root?.className).not.toContain("overflow-hidden")
  })
})

describe("Stat", () => {
  it("sets the numeral in the display face", () => {
    render(<Stat label="Open deals" value="14" />)
    const numeral = screen.getByText("14")
    expect(numeral.className).toContain("font-display")
  })

  it("does not uppercase or track the label", () => {
    render(<Stat label="Open deals" value="14" />)
    const label = screen.getByText(/Open deals/)
    expect(label.className).not.toContain("uppercase")
    expect(label.className).not.toContain("tracking-[0.08em]")
  })
})
