import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { sendEmail } from "@/modules/email/adapter"

describe("email adapter", () => {
  const OLD = process.env
  beforeEach(() => { process.env = { ...OLD } })
  afterEach(() => { process.env = OLD; vi.restoreAllMocks() })

  it("returns a mock result when creds absent", async () => {
    delete process.env.RESEND_API_KEY
    delete process.env.EMAIL_FROM
    const r = await sendEmail({ to: "ravi@example.com", subject: "Hi", body: "Welcome" })
    expect(r.mock).toBe(true)
    expect(r.id).toBeTruthy()
    expect(r.to).toBe("ravi@example.com")
  })

  it("calls Resend when creds present", async () => {
    process.env.RESEND_API_KEY = "re_xxx"
    process.env.EMAIL_FROM = "sales@acme.com"
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ id: "email-1" }) })
    vi.stubGlobal("fetch", fetchMock)
    const r = await sendEmail({ to: "ravi@example.com", subject: "Hi", body: "Welcome" })
    expect(fetchMock).toHaveBeenCalledOnce()
    const [url, opts] = fetchMock.mock.calls[0]
    expect(url).toBe("https://api.resend.com/emails")
    expect(opts.headers.Authorization).toBe("Bearer re_xxx")
    expect(r.mock).toBe(false)
    expect(r.id).toBe("email-1")
  })
})
