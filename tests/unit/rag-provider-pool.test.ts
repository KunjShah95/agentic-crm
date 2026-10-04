import { describe, it, expect, vi, afterEach } from "vitest"

import { runPool, fetchJson, onRateLimit, isCoolingDown } from "@/modules/rag/providers/http"

/**
 * The provider pool every RAG call goes through.
 *
 * The product runs entirely on free cloud tiers, so a provider returning 429 or
 * dying mid-request is a normal operating condition rather than an exception. This
 * is the code that keeps a rate-limited Groq from becoming a failed search — and
 * it never throws, which is the property that makes that true.
 */

/** An error shaped the way `fetchJson` throws, carrying the HTTP status. */
const httpError = (status: number, message = "upstream failed") =>
  Object.assign(new Error(`HTTP ${status}: ${message}`), { status });

/**
 * Provider names are unique per test on purpose. The cooldown map is module-level
 * and persists for the life of the file, so reusing a name would let one case's
 * 429 silently remove a provider from a later case's pool — and the assertion that
 * follows would fail for a reason that has nothing to do with the code.
 */
let seq = 0;
const provider = (
  behaviour: "ok" | "throw" | "throw429" | "disabled",
  out: { text: string } = { text: "answer" }
) => {
  const name = `p${seq++}-${behaviour}`;
  return {
    name,
    provider: {
      name,
      isEnabled: () => behaviour !== "disabled",
      call: async () => {
        if (behaviour === "throw") throw new Error("connection reset")
        if (behaviour === "throw429") throw httpError(429)
        return out
      },
    },
  };
};

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("runPool", () => {
  it("returns the first provider's result", async () => {
    const a = provider("ok", { text: "from-a" });
    const b = provider("ok", { text: "from-b" });

    const result = await runPool("llm", [a.provider, b.provider], "q", async () => ({ text: "mock" }))

    expect(result.text).toBe("from-a")
    expect(result.providerUsed).toBe(a.name)
  })

  /**
   * The whole reason this module exists. A dead provider must not become a failed
   * search: the pool falls through and the caller still gets an answer.
   */
  it("falls through to the next provider when one throws", async () => {
    const dead = provider("throw");
    const alive = provider("ok", { text: "from-second" })

    const result = await runPool("llm", [dead.provider, alive.provider], "q", async () => ({
      text: "mock",
    }))

    expect(result.text).toBe("from-second")
    expect(result.providerUsed).toBe(alive.name)
  })

  /** Observability: the answer records which provider actually answered it. */
  it("reports which provider served the result", async () => {
    const a = provider("ok")
    const result = await runPool("llm", [a.provider], "q", async () => ({ text: "mock" }))
    expect(result.providerUsed).toBe(a.name)
  })

  it("falls open to the mock when every provider fails", async () => {
    const a = provider("throw")
    const b = provider("throw")

    const result = await runPool("llm", [a.provider, b.provider], "q", async () => ({
      text: "mock answer",
    }))

    expect(result.text).toBe("mock answer")
    expect(result.providerUsed).toBe("mock")
  })

  it("never throws, whatever the providers do", async () => {
    const a = provider("throw")
    await expect(
      runPool("llm", [a.provider], "q", async () => ({ text: "mock" }))
    ).resolves.toBeDefined()
  })

  it("skips a disabled provider without calling it", async () => {
    const off = provider("disabled")
    const on = provider("ok", { text: "from-enabled" })
    const spy = vi.spyOn(off.provider, "call")

    const result = await runPool("llm", [off.provider, on.provider], "q", async () => ({
      text: "mock",
    }))

    expect(spy).not.toHaveBeenCalled()
    expect(result.providerUsed).toBe(on.name)
  })

  /**
   * A 429 means "come back later", so the provider is sidelined for the cooldown.
   * Without this every subsequent request would re-attempt a rate-limited API and
   * burn the whole latency budget on 429s before falling through.
   */
  it("sidelines a rate-limited provider", async () => {
    const limited = provider("throw429")
    const name = limited.name

    expect(isCoolingDown(name)).toBe(false)
    await runPool("llm", [limited.provider], "q", async () => ({ text: "mock" }))
    expect(isCoolingDown(name)).toBe(true)
  })

  it("skips a cooling-down provider on the next call", async () => {
    const limited = provider("throw429")
    const spy = vi.spyOn(limited.provider, "call")

    await runPool("llm", [limited.provider], "q", async () => ({ text: "mock" }))
    spy.mockClear()
    await runPool("llm", [limited.provider], "q", async () => ({ text: "mock" }))

    expect(spy).not.toHaveBeenCalled()
  })

  /**
   * Only 429 sidelines. A 500 or a dropped connection is transient and specific to
   * that one request; treating it as rate-limiting would take a healthy provider
   * out of rotation for 30 seconds over a single blip.
   */
  it("does not sideline a provider that failed for another reason", async () => {
    const broken = provider("throw")
    const name = broken.name

    await runPool("llm", [broken.provider], "q", async () => ({ text: "mock" }))

    expect(isCoolingDown(name)).toBe(false)
  })

  it("uses the mock when every provider is disabled", async () => {
    const a = provider("disabled")
    const result = await runPool("llm", [a.provider], "q", async () => ({ text: "mock" }))
    expect(result.providerUsed).toBe("mock")
  })

  it("passes the payload through to the provider and to the mock", async () => {
    const payload = { query: "refund policy", topK: 8 }
    const seen: unknown[] = []
    const a = provider("throw")

    await runPool(
      "llm",
      [a.provider],
      payload,
      async (p) => {
        seen.push(p)
        return { text: "mock" }
      }
    )

    expect(seen[0]).toBe(payload)
  })

  it("preserves other fields on the provider's result", async () => {
    const a = provider("ok", { text: "answer" })
    const withExtras = {
      name: a.name,
      isEnabled: () => true,
      call: async () => ({ text: "answer", tokens: 42 }),
    }

    const result = await runPool("llm", [withExtras], "q", async () => ({ text: "mock" }))

    expect(result.text).toBe("answer")
    expect(result.providerUsed).toBe(a.name)
  })
})

describe("cooldown helpers", () => {
  it("starts a cooldown on demand", () => {
    const name = "manual-cooldown-target"
    expect(isCoolingDown(name)).toBe(false)
    onRateLimit(name)
    expect(isCoolingDown(name)).toBe(true)
  })

  it("reports an unknown provider as not cooling down", () => {
    expect(isCoolingDown("never-seen-before")).toBe(false)
  })
})

describe("fetchJson", () => {
  it("returns parsed JSON on success", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: true, json: async () => ({ hello: "world" }) }))
    )

    await expect(fetchJson<{ hello: string }>("https://example.test")).resolves.toEqual({
      hello: "world",
    })
  })

  /**
   * The status has to survive onto the thrown error: `runPool` reads it to decide
   * whether to start a cooldown, and a generic `Error` would make every 429 look
   * like an ordinary failure — so the rate-limited provider stays in rotation and
   * keeps getting hammered.
   */
  it("throws with the HTTP status attached", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: false, status: 429, text: async () => "slow down" }))
    )

    const error = (await fetchJson("https://example.test").catch((e: unknown) => e)) as Error & {
      status?: number
    }

    expect(error).toBeInstanceOf(Error)
    expect(error.status).toBe(429)
    expect(error.message).toContain("429")
  })

  it("serialises an object body to JSON", async () => {
    /* Parameters declared so `mock.calls[0]` is a two-tuple. A `vi.fn(async () =>
       …)` with no parameters has a zero-length call tuple, so indexing `[1]` is a
       type error rather than an assertion. */
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) => ({
      ok: true,
      json: async () => ({}),
    }))
    vi.stubGlobal("fetch", fetchMock)

    await fetchJson("https://example.test", { body: { a: 1 } })

    expect(fetchMock.mock.calls[0][1]?.body).toBe(JSON.stringify({ a: 1 }))
  })

  /** A pre-serialised string must not be double-encoded into a quoted string. */
  it("passes a string body through unchanged", async () => {
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) => ({
      ok: true,
      json: async () => ({}),
    }))
    vi.stubGlobal("fetch", fetchMock)

    await fetchJson("https://example.test", { body: '{"already":"json"}' })

    expect(fetchMock.mock.calls[0][1]?.body).toBe('{"already":"json"}')
  })

  it("does not leave the abort timer pending after a call", async () => {
    const clearSpy = vi.spyOn(globalThis, "clearTimeout")
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, json: async () => ({}) })))

    await fetchJson("https://example.test")

    expect(clearSpy).toHaveBeenCalled()
  })
})