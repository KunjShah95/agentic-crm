import { describe, it, expect, vi, beforeEach } from "vitest"
import { WhatsAppProvider } from "@/modules/social/providers/whatsapp"
import { normalizePhone, phoneLookupKey } from "@/modules/social/ingest"

const CREDENTIALS = {
  WHATSAPP_TOKEN: "test-token",
  WHATSAPP_PHONE_NUMBER_ID: "123456789",
  WHATSAPP_APP_SECRET: "test-app-secret",
  WHATSAPP_VERIFY_TOKEN: "test-verify-token",
  WHATSAPP_APP_ID: "app-id",
}

const ORIGINAL = { ...process.env }

beforeEach(() => {
  process.env = { ...ORIGINAL }
})

function configured() {
  Object.assign(process.env, CREDENTIALS)
}

/** Meta's real webhook envelope: one batch, many messages, plus receipts. */
function batch(overrides: Record<string, unknown> = {}) {
  return {
    object: "whatsapp_business_account",
    entry: [
      {
        id: "WABA_1",
        changes: [
          {
            field: "messages",
            value: {
              messaging_product: "whatsapp",
              metadata: {
                display_phone_number: "919876543210",
                phone_number_id: "123456789",
              },
              contacts: [{ wa_id: "919812345678", profile: { name: "Ravi Kumar" } }],
              messages: [
                {
                  from: "919812345678",
                  id: "wamid.IN1",
                  timestamp: "1700000000",
                  text: { body: "Is the 3BHK still available?" },
                },
                ...(((overrides.extraMessages as unknown[]) ?? []) as unknown[]),
              ],
              statuses: (((overrides.statuses as unknown[]) ?? []) as unknown[]),
            },
          },
        ],
      },
    ],
  }
}

describe("WhatsAppProvider.verifyWebhook", () => {
  it("accepts the hub.challenge handshake when the verify token matches", () => {
    configured()
    const p = new WhatsAppProvider()
    expect(
      p.verifyWebhook({
        query: { "hub.mode": "subscribe", "hub.verify_token": "test-verify-token", "hub.challenge": "42" },
      }),
    ).toBe(true)
  })

  it("rejects a wrong verify token", () => {
    configured()
    const p = new WhatsAppProvider()
    expect(
      p.verifyWebhook({
        query: { "hub.mode": "subscribe", "hub.verify_token": "attacker", "hub.challenge": "42" },
      }),
    ).toBe(false)
  })

  it("fails closed when no verify token is configured (the old code accepted anything)", () => {
    const p = new WhatsAppProvider()
    expect(
      p.verifyWebhook({
        query: { "hub.mode": "subscribe", "hub.verify_token": "anything", "hub.challenge": "1" },
      }),
    ).toBe(false)
  })

  it("accepts a correctly signed POST", () => {
    configured()
    const crypto = require("crypto")
    const raw = JSON.stringify(batch())
    const sig = "sha256=" + crypto.createHmac("sha256", "test-app-secret").update(raw).digest("hex")
    const p = new WhatsAppProvider()
    expect(p.verifyWebhook({ headers: { "x-hub-signature-256": sig }, rawBody: raw })).toBe(true)
  })

  it("rejects a tampered body and a missing signature", () => {
    configured()
    const p = new WhatsAppProvider()
    const raw = JSON.stringify(batch())
    const crypto = require("crypto")
    const sig = "sha256=" + crypto.createHmac("sha256", "test-app-secret").update(raw).digest("hex")
    expect(p.verifyWebhook({ headers: { "x-hub-signature-256": sig }, rawBody: raw + " " })).toBe(false)
    expect(p.verifyWebhook({ headers: {}, rawBody: raw })).toBe(false)
  })

  it("fails closed for POST with no app secret", () => {
    Object.assign(process.env, { WHATSAPP_TOKEN: "t", WHATSAPP_PHONE_NUMBER_ID: "1" })
    const p = new WhatsAppProvider()
    expect(p.verifyWebhook({ headers: { "x-hub-signature-256": "sha256=deadbeef" }, rawBody: "{}" })).toBe(false)
  })
})

describe("WhatsAppProvider.parseEvents", () => {
  const p = new WhatsAppProvider()

  it("parses an inbound text message with sender identity and thread", () => {
    const events = p.parseEvents(batch())
    expect(events).toHaveLength(1)
    expect(events[0]).toMatchObject({
      kind: "message",
      externalId: "wamid.IN1",
      from: { number: "919812345678", name: "Ravi Kumar" },
      body: "Is the 3BHK still available?",
      threadId: "123456789",
    })
    expect((events[0] as { timestamp: string }).timestamp).toMatch(/^2023-11-1[45]T/)
  })

  it("keeps every message in a multi-message batch (the old normalize dropped all but one)", () => {
    const events = p.parseEvents(
      batch({ extraMessages: [{ from: "919812345678", id: "wamid.IN2", timestamp: "1700000001", text: { body: "hello?" } }] }),
    )
    expect(events.map((e) => e.externalId)).toEqual(["wamid.IN1", "wamid.IN2"])
  })

  it("maps media messages to a placeholder body and typed media", () => {
    const events = p.parseEvents(
      batch({ extraMessages: [{ from: "919812345678", id: "wamid.IMG", timestamp: "1700000002", type: "image", image: { id: "media-9", mimetype: "image/jpeg" } }] }),
    )
    const img = events.find((e) => e.externalId === "wamid.IMG") as { kind: string; body: string; mediaType: string }
    expect(img.body).toBe("[image]")
    expect(img.mediaType).toBe("image")
  })

  it("parses delivery receipts as status events", () => {
    const events = p.parseEvents(
      batch({ statuses: [{ id: "wamid.OUT1", status: "delivered", timestamp: "1700000003", recipient_id: "919812345678" }] }),
    )
    const status = events.find((e) => e.kind === "status") as { kind: string; status: string; externalId: string }
    expect(status.status).toBe("delivered")
    expect(status.externalId).toBe("wamid.OUT1")
  })

  it("ignores unknown status verbs and id-less messages", () => {
    const events = p.parseEvents(
      batch({ statuses: [{ id: "x", status: "party_parrot", timestamp: "1700000003" }], extraMessages: [{ from: "919812345678", text: { body: "no id" } }] }),
    )
    expect(events.some((e) => e.kind === "status")).toBe(false)
    expect(events.filter((e) => e.kind === "message")).toHaveLength(1)
  })

  it("returns nothing for a non-WhatsApp payload", () => {
    expect(p.parseEvents({ hello: "world" })).toEqual([])
    expect(p.parseEvents(null)).toEqual([])
  })
})

describe("WhatsApp config readiness", () => {
  it("reports missing send + receive credentials", async () => {
    const { whatsappReadiness } = await import("@/modules/whatsapp/config")
    const r = whatsappReadiness({
      appId: "", appSecret: "", verifyToken: "", accessToken: "", phoneNumberId: "", wabaId: "", graphVersion: "v23.0", webhookBaseUrl: "", redirectUri: "",
    })
    expect(r.canSend).toBe(false)
    expect(r.canReceive).toBe(false)
    expect(r.missing).toContain("WHATSAPP_TOKEN")
    expect(r.missing).toContain("WHATSAPP_APP_SECRET")
  })

  it("is ready when token, number id, app secret and verify token exist", async () => {
    const { whatsappReadiness } = await import("@/modules/whatsapp/config")
    const r = whatsappReadiness({
      appId: "a", appSecret: "s", verifyToken: "v", accessToken: "t", phoneNumberId: "p", wabaId: "w", graphVersion: "v23.0", webhookBaseUrl: "https://x.vercel.app", redirectUri: "",
    })
    expect(r.canSend && r.canReceive).toBe(true)
  })

  it("builds the callback URL the admin must paste into Meta", async () => {
    const { whatsappWebhookUrl } = await import("@/modules/whatsapp/config")
    expect(whatsappWebhookUrl({ webhookBaseUrl: "https://app.example.com///" } as never)).toBe("https://app.example.com/api/whatsapp/webhook")
  })
})

describe("phone normalisation", () => {
  it("strips formatting and keys on the last 10 digits", () => {
    expect(normalizePhone("+91 98123-45678")).toBe("919812345678")
    expect(phoneLookupKey("+919812345678")).toBe("9812345678")
    expect(phoneLookupKey(null)).toBe("")
  })
})

describe("provider registry is WhatsApp-only", () => {
  it("resolves whatsapp and refuses the removed providers", async () => {
    const { getProvider, isSupportedProvider } = await import("@/modules/social/provider")
    expect(getProvider("wa").name).toBe("whatsapp")
    expect(isSupportedProvider("x")).toBe(false)
    expect(isSupportedProvider("linkedin")).toBe(false)
    expect(() => getProvider("unipile")).toThrow(/only "whatsapp"/)
  })
})

describe("account linking", () => {
  it("refuses to build an OAuth URL without an app id instead of faking one", () => {
    const p = new WhatsAppProvider()
    expect(() => p.getAuthUrl("state")).toThrow(/not configured/)
  })

  it("builds a scoped Meta dialog URL when configured", () => {
    configured()
    const p = new WhatsAppProvider()
    const url = p.getAuthUrl("signed-state")
    expect(url).toContain("www.facebook.com")
    expect(url).toContain("whatsapp_business_messaging")
    expect(url).toContain("state=signed-state")
    expect(url).toContain("api%2Fauth%2Fwhatsapp%2Fcallback")
  })

  it("reports configuration status for the settings UI", () => {
    const p = new WhatsAppProvider()
    const s = p.configStatus()
    expect(s.ok).toBe(false)
    expect(s.missing.length).toBeGreaterThan(0)
  })
})

describe("outbound send", () => {
  it("posts to the number id from connection metadata and returns the real wamid", async () => {
    configured()
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ messages: [{ id: "wamid.OUT9" }] }),
    })
    vi.stubGlobal("fetch", fetchMock)

    const p = new WhatsAppProvider()
    const res = await p.send({ accessToken: "tok", metadata: { phoneNumberId: "999" }, to: "+91 98123 45678", body: "Hi" })

    expect(res).toEqual({ externalId: "wamid.OUT9", mock: false })
    const [url, init] = fetchMock.mock.calls[0]
    expect(String(url)).toContain("graph.facebook.com")
    expect(String(url)).toContain("/999/messages")
    expect(JSON.parse(init.body)).toMatchObject({ to: "919812345678", type: "text", messaging_product: "whatsapp" })
    vi.unstubAllGlobals()
  })

  it("throws rather than inventing a message id when Meta rejects", async () => {
    configured()
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({ error: { code: 131047, error_user_msg: "Reopen window" } }),
      text: async () => "{}",
    }))
    const p = new WhatsAppProvider()
    await expect(p.send({ accessToken: "tok", metadata: { phoneNumberId: "999" }, to: "919812345678", body: "Hi" })).rejects.toThrow()
    vi.unstubAllGlobals()
  })

  it("never silently mocks when the send is not configured", async () => {
    const { sendWhatsApp } = await import("@/modules/whatsapp/adapter")
    await expect(sendWhatsApp({ to: "919812345678", body: "hi" })).rejects.toThrow(/not configured/)
  })
})
