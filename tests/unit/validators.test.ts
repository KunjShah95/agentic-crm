import { describe, expect, it } from "vitest"

import { activitySchema, contactSchema, dealSchema, inviteSchema, pipelineStageSchema, reorderStagesSchema } from "@/lib/validators"

describe("validators", () => {
  describe("contactSchema", () => {
    it("requires firstName", () => {
      expect(contactSchema.safeParse({ firstName: "" }).success).toBe(false)
      expect(contactSchema.safeParse({ firstName: "Ada" }).success).toBe(true)
    })
    it("allows empty optional fields", () => {
      const parsed = contactSchema.safeParse({ firstName: "Ada", email: "" })
      expect(parsed.success).toBe(true)
    })
  })

  describe("dealSchema", () => {
    it("requires title and stageId", () => {
      expect(dealSchema.safeParse({ title: "", stageId: "s1" }).success).toBe(false)
      expect(dealSchema.safeParse({ title: "Acme", stageId: "" }).success).toBe(false)
      expect(dealSchema.safeParse({ title: "Acme", stageId: "s1" }).success).toBe(true)
    })
  })

  describe("pipelineStageSchema", () => {
    it("validates name", () => {
      expect(pipelineStageSchema.safeParse({ name: "" }).success).toBe(false)
      expect(pipelineStageSchema.safeParse({ name: "Lead" }).success).toBe(true)
    })
  })

  describe("reorderStagesSchema", () => {
    it("requires orderedIds array", () => {
      expect(reorderStagesSchema.safeParse({ orderedIds: [] }).success).toBe(false)
      expect(reorderStagesSchema.safeParse({ orderedIds: ["a", "b"] }).success).toBe(true)
    })
  })

  describe("activitySchema", () => {
    it("validates type and allows assigneeId", () => {
      const ok = activitySchema.safeParse({ type: "TASK", body: "todo", assigneeId: "user_1", scheduledAt: null })
      expect(ok.success).toBe(true)
      const bad = activitySchema.safeParse({ type: "INVALID" as never })
      expect(bad.success).toBe(false)
    })
  })

  describe("inviteSchema", () => {
    it("validates email and role", () => {
      expect(inviteSchema.safeParse({ email: "bad", role: "ADMIN" }).success).toBe(false)
      expect(inviteSchema.safeParse({ email: "a@b.com", role: "MEMBER" }).success).toBe(true)
    })
  })
})
