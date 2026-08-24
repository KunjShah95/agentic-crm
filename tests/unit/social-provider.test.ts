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

describe("SocialConnection encrypt", () => {
  it("encrypts and decrypts", async () => {
    const { encrypt, decrypt } = await import("@/modules/social/connections")
    const enc = encrypt("secret")
    expect(decrypt(enc)).toBe("secret")
  })
  it("encrypt output is not plaintext and is base64", async () => {
    const { encrypt } = await import("@/modules/social/connections")
    const enc = encrypt("hello-world")
    expect(enc).not.toBe("hello-world")
    // should be valid base64
    expect(() => Buffer.from(enc, "base64")).not.toThrow()
    expect(Buffer.from(enc, "base64").length).toBeGreaterThan(0)
  })
  it("round-trips unicode and empty string", async () => {
    const { encrypt, decrypt } = await import("@/modules/social/connections")
    expect(decrypt(encrypt(""))).toBe("")
    expect(decrypt(encrypt("héllo 🌍"))).toBe("héllo 🌍")
  })
})
