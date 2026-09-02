import { describe, it, expect } from "vitest"
import fs from "fs"
import { RE_STAGES } from "@/modules/booking/stages"
import { brokerSchema, commissionSchema, siteVisitSchema } from "@/lib/validators/re"

describe("M3 schema + validators", () => {
  const s = fs.readFileSync("prisma/schema.prisma", "utf8")

  it("defines SiteVisit, Broker, CommissionRule models", () => {
    expect(s).toContain("model SiteVisit")
    expect(s).toContain("model Broker")
    expect(s).toContain("model CommissionRule")
  })

  it("extends Role with SALES/BROKER/VIEWER and Deal with brokerId", () => {
    expect(s).toMatch(/enum Role[\s\S]*SALES[\s\S]*BROKER[\s\S]*VIEWER/)
    expect(s).toMatch(/brokerId\s+String\?/)
  })

  it("adds dueTrigger/daysAfter to PaymentMilestone", () => {
    expect(s).toMatch(/model PaymentMilestone[\s\S]*dueTrigger[\s\S]*daysAfter/)
  })

  it("RE_STAGES is the full lifecycle", () => {
    expect(RE_STAGES[0]).toBe("INQUIRY")
    expect(RE_STAGES.at(-1)).toBe("CLOSED")
  })

  it("commission validator requires pct or amount", () => {
    expect(commissionSchema.safeParse({ dealId: "d1", brokerId: "cp1" }).success).toBe(false)
    expect(commissionSchema.safeParse({ dealId: "d1", brokerId: "cp1", pct: 2 }).success).toBe(true)
  })

  it("broker + siteVisit validators accept minimal input", () => {
    expect(brokerSchema.safeParse({ name: "Acme Realtors" }).success).toBe(true)
    expect(siteVisitSchema.safeParse({ leadId: "c1", scheduledAt: "2026-09-10T10:00:00Z" }).success).toBe(true)
  })
})
