import { describe, it, expect } from "vitest"
import crypto from "crypto"
import { XDirectProvider, verifyXWebhook } from "@/modules/social/providers/x"

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

describe("verifyXWebhook", () => {
  it("rejects bad signature", () => {
    const prev = process.env.X_CONSUMER_SECRET
    process.env.X_CONSUMER_SECRET = "test_secret_123"
    const rawBody = JSON.stringify({ event: "test" })
    const badSig = "sha256=invalidsignature0000000000000000000000000000"
    expect(verifyXWebhook({ headers: { "x-twitter-webhooks-signature": badSig }, rawBody })).toBe(false)
    // valid signature should return true
    const validSig = `sha256=${crypto.createHmac("sha256", "test_secret_123").update(rawBody).digest("base64")}`
    expect(verifyXWebhook({ headers: { "x-twitter-webhooks-signature": validSig }, rawBody })).toBe(true)
    // missing rawBody / no verifiable material -> false
    expect(verifyXWebhook({ headers: {}, body: {} })).toBe(false)
    if (prev === undefined) delete process.env.X_CONSUMER_SECRET
    else process.env.X_CONSUMER_SECRET = prev
  })

  it("rejects CRC with bad signature header using timingSafeEqual", () => {
    const prev = process.env.X_CONSUMER_SECRET
    process.env.X_CONSUMER_SECRET = "crc_secret"
    const crc = "test_crc_token"
    const bad = "sha256=badbadbadbadbadbadbadbadbadbadbadbadbadbad"
    expect(verifyXWebhook({ headers: { "x-twitter-webhooks-signature": bad }, query: { crc_token: crc } })).toBe(false)
    if (prev === undefined) delete process.env.X_CONSUMER_SECRET
    else process.env.X_CONSUMER_SECRET = prev
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
