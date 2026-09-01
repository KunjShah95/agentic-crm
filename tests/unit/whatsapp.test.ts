import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { renderWaTemplate, formatCostSheetMessage, sendWhatsApp, WA_TEMPLATES } from "@/modules/whatsapp/adapter"

describe("whatsapp adapter", () => {
  it("renders a template with vars", () => {
    const out = renderWaTemplate("lead_ack", { name: "Ravi", project: "Sun Residency", workspace: "Acme" })
    expect(out).toContain("Ravi")
    expect(out).toContain("Sun Residency")
    expect(out).not.toContain("{{")
  })
  it("has known templates", () => {
    expect(Object.keys(WA_TEMPLATES)).toContain("lead_ack")
  })
  it("formats a cost sheet as INR text", () => {
    const msg = formatCostSheetMessage({ unitNo: "A-101", basePrice: 5000000, gst: 250000, stampDuty: 300000, total: 5550000 })
    expect(msg).toContain("A-101")
    expect(msg).toContain("₹")
    expect(msg).toContain("55,50,000")
  })

  describe("sendWhatsApp", () => {
    const OLD = process.env
    beforeEach(() => { process.env = { ...OLD } })
    afterEach(() => { process.env = OLD; vi.restoreAllMocks() })

    it("returns mock result when creds absent", async () => {
      delete process.env.WHATSAPP_TOKEN
      delete process.env.WHATSAPP_PHONE_ID
      const r = await sendWhatsApp({ to: "+919812345678", body: "hi" })
      expect(r.mock).toBe(true)
      expect(r.id).toBeTruthy()
    })

    it("calls Graph API when creds present", async () => {
      process.env.WHATSAPP_TOKEN = "tok"
      process.env.WHATSAPP_PHONE_ID = "123"
      const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ messages: [{ id: "wamid.X" }] }) })
      vi.stubGlobal("fetch", fetchMock)
      const r = await sendWhatsApp({ to: "+919812345678", body: "hi" })
      expect(fetchMock).toHaveBeenCalledOnce()
      expect(r.mock).toBe(false)
      expect(r.id).toBe("wamid.X")
    })
  })
})
