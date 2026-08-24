import { describe, it, expect } from "vitest"
import { XDirectProvider } from "@/modules/social/providers/x"

describe("SocialProvider normalize", () => {
  it("normalizes X DM", () => {
    const p = new XDirectProvider()
    const result = p.normalize({
      event: {
        type: "message_create",
        message_create: { message_data: { text: "hi" } },
      },
    } as unknown as never)
    expect(result.body).toBe("hi")
  })
})
