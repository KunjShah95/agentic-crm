import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import {
  hashIngestSecret,
  autoAckFromSettings,
  extractIngestKey,
  requireIngressAuth,
  getLeadIngestSettings,
  isAutoAckEnabled,
} from "@/modules/leadIngest/ingress"

const SECRET = "lei_" + "a".repeat(48)

vi.mock("@/lib/db", () => ({
  db: {
    workspace: {
      findUnique: vi.fn(),
      update: vi.fn(async () => ({})),
    },
    activity: { create: vi.fn(async () => ({})) },
  },
}))

const { db } = await import("@/lib/db")

function settingsRow(settingsJson: unknown) {
  ;(db.workspace.findUnique as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
    settingsJson,
  })
}

function reqWith(init?: RequestInit) {
  return new Request("https://app.example.com/api/webhooks/leads/meta", init)
}

describe("lead ingest secret hashing", () => {
  it("is deterministic so a stored hash can be compared to a presented key", () => {
    expect(hashIngestSecret(SECRET)).toBe(hashIngestSecret(SECRET))
    expect(hashIngestSecret(SECRET)).toHaveLength(64)
  })

  it("does not embed the secret", () => {
    expect(hashIngestSecret(SECRET)).not.toContain(SECRET)
  })

  it("separates different secrets", () => {
    expect(hashIngestSecret(SECRET)).not.toBe(hashIngestSecret(SECRET + "x"))
  })
})

describe("extractIngestKey", () => {
  it("reads the primary header", () => {
    expect(extractIngestKey(reqWith({ headers: { "x-estate360-ingest-key": SECRET } }))).toBe(SECRET)
  })

  it("reads the alias header portals send", () => {
    expect(extractIngestKey(reqWith({ headers: { "x-ingest-key": SECRET } }))).toBe(SECRET)
  })

  it("accepts a bearer token", () => {
    expect(extractIngestKey(reqWith({ headers: { authorization: `Bearer ${SECRET}` } }))).toBe(SECRET)
  })

  it("ignores a non-bearer authorization scheme", () => {
    expect(extractIngestKey(reqWith({ headers: { authorization: "Basic abc" } }))).toBeNull()
  })

  it("treats a blank header as absent rather than as an empty credential", () => {
    expect(extractIngestKey(reqWith({ headers: { "x-estate360-ingest-key": "  " } }))).toBeNull()
  })
})

describe("requireIngressAuth", () => {
  beforeEach(() => {
    settingsRow({ leadIngest: { secretHash: hashIngestSecret(SECRET) } })
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it("accepts a request carrying the workspace secret", async () => {
    vi.stubEnv("NODE_ENV", "production")
    const res = await requireIngressAuth(
      reqWith({ headers: { "x-estate360-ingest-key": SECRET } }),
      "ws1"
    )
    expect(res).toEqual({ ok: true })
  })

  it("rejects a request with no credential — an open endpoint was the original bug", async () => {
    vi.stubEnv("NODE_ENV", "production")
    const res = await requireIngressAuth(reqWith(), "ws1")
    expect(res.ok).toBe(false)
    expect(res).toMatchObject({ status: 401 })
  })

  it("rejects a wrong credential without revealing which part was wrong", async () => {
    vi.stubEnv("NODE_ENV", "production")
    const res = await requireIngressAuth(
      reqWith({ headers: { "x-estate360-ingest-key": "lei_wrong" } }),
      "ws1"
    )
    expect(res).toMatchObject({ status: 401, error: "Invalid ingest key" })
  })

  it("rejects a key that is a prefix of the real one", async () => {
    vi.stubEnv("NODE_ENV", "production")
    const res = await requireIngressAuth(
      reqWith({ headers: { "x-estate360-ingest-key": SECRET.slice(0, 40) } }),
      "ws1"
    )
    expect(res).toMatchObject({ status: 401 })
  })

  it("refuses a correct key sent to a workspace with no secret configured", async () => {
    // The presented key must not be able to *create* authorization: the stored
    // hash is the only accepted value.
    vi.stubEnv("NODE_ENV", "production")
    settingsRow({})
    const res = await requireIngressAuth(
      reqWith({ headers: { "x-estate360-ingest-key": SECRET } }),
      "ws1"
    )
    expect(res).toMatchObject({ status: 503 })
  })

  it("reports an unconfigured workspace as 503, not 401, so portals retry instead of dropping", async () => {
    vi.stubEnv("NODE_ENV", "production")
    settingsRow({})
    const res = await requireIngressAuth(reqWith(), "ws1")
    expect(res).toMatchObject({ status: 503 })
  })

  it("is permissive outside production so local dev and the seed still work", async () => {
    vi.stubEnv("NODE_ENV", "development")
    settingsRow({})
    const res = await requireIngressAuth(reqWith(), "ws1")
    expect(res).toEqual({ ok: true })
  })

  it("still enforces the secret in development once one is configured", async () => {
    vi.stubEnv("NODE_ENV", "development")
    const res = await requireIngressAuth(reqWith(), "ws1")
    expect(res.ok).toBe(false)
  })
})

describe("auto-ack opt-in", () => {
  it("defaults off when no settings exist", () => {
    expect(autoAckFromSettings(null)).toBe(false)
    expect(autoAckFromSettings({})).toBe(false)
  })

  it("defaults off when the workspace never opted in", () => {
    expect(autoAckFromSettings({ leadIngest: { secretHash: "abc" } })).toBe(false)
  })

  it("is on only when explicitly set true", () => {
    expect(autoAckFromSettings({ leadIngest: { autoAck: true } })).toBe(true)
    expect(autoAckFromSettings({ leadIngest: { autoAck: false } })).toBe(false)
    // A truthy non-boolean must not be read as consent.
    expect(autoAckFromSettings({ leadIngest: { autoAck: "true" } })).toBe(false)
  })

  it("reads through the db-backed accessor", async () => {
    settingsRow({ leadIngest: { autoAck: true } })
    expect(await isAutoAckEnabled("ws1")).toBe(true)
  })
})

describe("getLeadIngestSettings", () => {
  it("tolerates a workspace with no settingsJson at all", async () => {
    settingsRow(null)
    await expect(getLeadIngestSettings("ws1")).resolves.toEqual({})
  })

  it("returns an empty object when the leadIngest block is missing", async () => {
    settingsRow({ rera: "RERA-GJ-1" })
    await expect(getLeadIngestSettings("ws1")).resolves.toEqual({})
  })
})
