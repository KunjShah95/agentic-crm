import { describe, it, expect } from "vitest"
import { buildDocContext, renderDocument } from "@/modules/documents/render"

describe("document render", () => {
  const ctx = buildDocContext({
    workspace: { name: "Acme Realty", settingsJson: { rera: "RERA-GJ-123" } },
    project: { name: "Sun Residency", reraNo: "RERA-GJ-123" },
    unit: { unitNo: "A-1201", carpetArea: 850, builtUp: 1100 },
    costSheet: { basePrice: 5_000_000, gst: 250_000, stampDuty: 300_000, total: 5_550_000 },
    contact: { firstName: "Ravi", lastName: "Patel" },
    extra: { milestone: "Foundation", demand_amount: "5,55,000" },
  })

  it("maps entities to shortcode values", () => {
    expect(ctx.rera_no).toBe("RERA-GJ-123")
    expect(ctx.unit_no).toBe("A-1201")
    expect(ctx.carpet_area).toBe("850")
    expect(ctx.total).toContain("55,50,000")
    expect(ctx.buyer_name).toBe("Ravi Patel")
    expect(ctx.milestone).toBe("Foundation")
  })

  it("fills a demand-letter template with no leftover placeholders", () => {
    const tpl = "Dear {{buyer_name}}, demand for unit {{unit_no}} at {{project_name}} (RERA {{rera_no}}): milestone {{milestone}} amount ₹{{demand_amount}}. Total ₹{{total}}."
    const out = renderDocument(tpl, ctx)
    expect(out).not.toContain("{{")
    expect(out).toContain("Ravi Patel")
    expect(out).toContain("A-1201")
    expect(out).toContain("Foundation")
  })
})
