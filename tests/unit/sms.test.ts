import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { sendSms } from "@/modules/sms/adapter"

describe("sms adapter", () => {
  const OLD = process.env
  beforeEach(() => { process.env = { ...OLD } })
  afterEach(() => { process.env = OLD; vi.restoreAllMocks() })

  it("returns a mock result when creds absent", async () => {
    delete process.env.TWILIO_ACCOUNT_SID
    delete process.env.TWILIO_AUTH_TOKEN
    delete process.env.TWILIO_FROM
    const r = await sendSms({ to: "+919812345678", body: "hi" })
    expect(r.mock).toBe(true)
    expect(r.id).toBeTruthy()
    expect(r.to).toBe("+919812345678")
  })

  it("calls Twilio when creds present", async () => {
    process.env.TWILIO_ACCOUNT_SID = "ACxxx"
    process.env.TWILIO_AUTH_TOKEN = "tok"
    process.env.TWILIO_FROM = "+15005550006"
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ sid: "SM123" }) })
    vi.stubGlobal("fetch", fetchMock)
    const r = await sendSms({ to: "+919812345678", body: "hi" })
    expect(fetchMock).toHaveBeenCalledOnce()
    const [url, opts] = fetchMock.mock.calls[0]
    expect(url).toContain("/Accounts/ACxxx/Messages.json")
    expect(opts.headers.Authorization).toMatch(/^Basic /)
    expect(r.mock).toBe(false)
    expect(r.id).toBe("SM123")
  })
})
