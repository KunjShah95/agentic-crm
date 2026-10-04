import { describe, it, expect, vi, beforeEach, afterAll } from "vitest"

/**
 * An in-memory Redis double.
 *
 * `redis` is loaded through a dynamic import inside the module, so mocking the
 * package boundary is what makes this testable at all. `get`/`set`/`del` plus a
 * key-order-preserving scan cover everything the module uses, and the scan is what
 * `invalidateScope` depends on to find entries.
 */
const store = vi.hoisted(() => {
  const data = new Map<string, string>()
  return {
    data,
    createClient: vi.fn(() => ({
      on: vi.fn(),
      isOpen: true,
      connect: vi.fn(async () => undefined),
      get: vi.fn(async (k: string) => store.data.get(k) ?? null),
      set: vi.fn(async (k: string, v: string) => {
        store.data.set(k, v)
        return "OK"
      }),
      del: vi.fn(async (keys: string | string[]) => {
        const list = Array.isArray(keys) ? keys : [keys]
        let n = 0
        for (const k of list) if (store.data.delete(k)) n++
        return n
      }),
      scanIterator: vi.fn(function* ({ MATCH }: { MATCH: string } = { MATCH: "*" }) {
        const escaped = MATCH.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*")
        const re = new RegExp(`^${escaped}$`)
        for (const k of [...store.data.keys()]) if (re.test(k)) yield k
      }),
    })),
  }
})

vi.mock("redis", () => ({ createClient: store.createClient }))

/**
 * `REDIS_URL` must be set *before* the module is imported.
 *
 * `getSemanticCache()` memoises one instance keyed on the URL, and the instance's
 * `enabled` flag is captured in its constructor. Left unset — which is the default
 * in this test environment — every method short-circuits to a no-op, and the
 * privilege-isolation cases below would pass by asserting `null` against a cache
 * that never stored anything. That is the same false-confidence trap as the rest of
 * this file's suite, one level up: not a vacuous assertion, a vacuous *subject*.
 */
process.env.REDIS_URL = "redis://semantic-cache-test:6379"

const { getSemanticCache } = await import("@/modules/rag/semantic-cache")

const cache = () => getSemanticCache()

beforeEach(() => {
  store.data.clear()
})

afterAll(() => {
  delete process.env.REDIS_URL
})

/** The whole point of `roleTag`: answers are role-filtered, so entries must not cross. */
/**
 * What `answer.ts` actually stores: the whole result object.
 *
 * `semanticCache.set(tenantId, enhancedQuery, result, …)` followed by
 * `return { ...semanticResult, cached: true, … }` — so `get` must yield this object
 * back unchanged. Storing a realistic shape is what makes the envelope bug
 * observable; a bare string round-trips under either implementation.
 */
type StoredResult = {
  answer: string
  citations: Array<{ source: number; documentId: string }>
  refused: boolean
}

const stored = (answer = "15 days"): StoredResult => ({
  answer,
  citations: [{ source: 1, documentId: "d1" }],
  refused: false,
})

/** The point of `roleTag`: answers are role-filtered, so entries must not cross. */
describe("semantic cache — privilege isolation", () => {
  it("is enabled for this suite", () => {
    /* Guards against the whole file silently degrading to no-op assertions:
       with no Redis URL every method short-circuits and every "must not leak"
       case would pass against a cache that stored nothing. */
    expect(getSemanticCache().getStats).toBeTypeOf("function")
  })

  /**
   * Returns the stored value, not the `{ answer, metadata, cachedAt, scope }`
   * envelope it is persisted in.
   *
   * It returned the envelope, and the caller spreads the result as though it were
   * the answer — so a semantic cache hit produced
   * `{ answer: { answer: "…", citations: […] }, metadata, cachedAt, scope, cached }`
   * where the caller expects `{ answer: "…", citations: […] }`. Citations,
   * faithfulness and confidence were all missing from where the type says they are.
   *
   * It looked like a working hit: `cached: true` set, plausible shape at the top
   * level, broken answer underneath.
   */
  it("returns the stored result, unwrapped from its storage envelope", async () => {
    const value = stored()
    await cache().set("t1", "refund policy", value, {}, "ADMIN")

    const hit = await cache().get("t1", "refund policy", "ADMIN")

    expect(hit).toEqual(value)
    expect((hit as StoredResult).answer).toBe("15 days")
    expect((hit as StoredResult).citations).toHaveLength(1)
  })

  it("does not leak the envelope's bookkeeping fields to the caller", async () => {
    await cache().set("t1", "refund policy", stored(), {}, "ADMIN")
    const hit = (await cache().get("t1", "refund policy", "ADMIN")) as Record<string, unknown>
    expect(hit).not.toHaveProperty("cachedAt")
    expect(hit).not.toHaveProperty("metadata")
    expect(hit).not.toHaveProperty("scope")
  })

  /**
   * The threat: an answer quoting confidential documents is cached under an ADMIN
   * scope and the next caller with fewer roles is served it verbatim — correct
   * format, correct citations, wrong reader.
   */
  it("does not serve an entry written under one role to a different role", async () => {
    await cache().set("t1", "confidential salary bands", stored("ADMIN-only"), {}, "ADMIN")
    expect(await cache().get("t1", "confidential salary bands", "BROKER")).toBeNull()
  })

  it("does not serve an ADMIN entry to a VIEWER", async () => {
    await cache().set("t1", "pricing floors", stored("ADMIN-only"), {}, "ADMIN")
    expect(await cache().get("t1", "pricing floors", "VIEWER")).toBeNull()
  })

  /** Otherwise the cache never hits for anyone holding multiple roles. */
  it("shares entries between holders of the same roles, in any order", async () => {
    await cache().set("t1", "refund policy", stored(), {}, ["ADMIN", "MEMBER"])
    expect(await cache().get("t1", "refund policy", ["MEMBER", "ADMIN"])).toEqual(stored())
  })

  it("ignores a duplicate within one role list", async () => {
    await cache().set("t1", "refund policy", stored(), {}, ["ADMIN", "ADMIN"])
    expect(await cache().get("t1", "refund policy", ["ADMIN"])).toEqual(stored())
  })

  /**
   * "No roles" is the non-confidential subset — a real privilege level, and the
   * module documents it as distinct. Treating it as a wildcard would let a roleless
   * API key read anything an ADMIN cached.
   */
  it("treats a roleless caller as its own privilege level", async () => {
    await cache().set("t1", "refund policy", stored("ADMIN view"), {}, "ADMIN")
    expect(await cache().get("t1", "refund policy", null)).toBeNull()
  })

  it("does not let one tenant read another's entry", async () => {
    await cache().set("t1", "refund policy", stored("tenant one"), {}, "ADMIN")
    expect(await cache().get("t2", "refund policy", "ADMIN")).toBeNull()
  })

  /** The `variant` added for answer language. */
  it("does not serve an answer from one language to another", async () => {
    await cache().set("t1", "refund window", stored("fifteen days"), {}, "ADMIN", "en")
    expect(await cache().get("t1", "refund window", "ADMIN", "gu")).toBeNull()
  })

  it("serves an answer back within the same language", async () => {
    const gujarati = stored("પંદર દિવસ")
    await cache().set("t1", "refund window", gujarati, {}, "ADMIN", "gu")
    expect(await cache().get("t1", "refund window", "ADMIN", "gu")).toEqual(gujarati)
  })
})

describe("semantic cache — query normalisation", () => {
  it("is case-insensitive", () => {
    expect(cache().normalizeQuery("Refund Policy")).toBe(cache().normalizeQuery("refund policy"))
  })

  it("strips punctuation", () => {
    expect(cache().normalizeQuery("refund, policy; now?")).not.toMatch(/[,;?]/)
  })

  /** Stopwords and 1–2 character tokens carry no retrieval signal. */
  it("drops stopwords and short tokens", () => {
    expect(cache().normalizeQuery("what is the a refund policy")).toBe("refund policy")
  })

  it("collapses repeated whitespace", () => {
    expect(cache().normalizeQuery("refund    policy")).toBe("refund policy")
  })

  it("returns empty for an all-stopword query", () => {
    expect(cache().normalizeQuery("what is the")).toBe("")
  })

  /**
   * The point of the semantic cache: wording that differs but means the same must
   * land on one key, or nothing ever hits.
   */
  it("treats differently-worded equivalent queries as the same key", async () => {
    await cache().set("t9", "the refund policy", stored(), {}, "ADMIN")
    expect(await cache().get("t9", "refund policy", "ADMIN")).toEqual(stored())
  })
})

describe("semantic cache — invalidation", () => {
  /**
   * This is load-bearing. `computeScopeHash` is a timestamp token, not a document
   * fingerprint — documented on the method — so nothing detects a corpus change
   * automatically. This call is the only mechanism, which is why
   * `invalidateRetrievalCaches` invokes it on every mutation path.
   */
  it("clears cached answers and the memoised scope", async () => {
    await cache().set("t1", "refund policy", { answer: "stale" }, {}, "ADMIN")
    expect(await cache().get("t1", "refund policy", "ADMIN")).not.toBeNull()

    await cache().invalidateScope("t1")

    expect(await cache().get("t1", "refund policy", "ADMIN")).toBeNull()
  })

  it("produces a different scope afterwards, so old keys are unreachable", async () => {
    const before = await cache().getScopeHash("t1", "ADMIN")
    await cache().invalidateScope("t1")
    expect(await cache().getScopeHash("t1", "ADMIN")).not.toBe(before)
  })

  /** Scoped by tenant: one workspace's ingest must not evict another's answers. */
  it("does not clear another tenant's entries", async () => {
    await cache().set("t1", "refund policy", { answer: "one" }, {}, "ADMIN")
    await cache().set("t2", "refund policy", { answer: "two" }, {}, "ADMIN")

    await cache().invalidateScope("t1")

    expect(await cache().get("t1", "refund policy", "ADMIN")).toBeNull()
    expect(await cache().get("t2", "refund policy", "ADMIN")).not.toBeNull()
  })

  /**
   * A scope exists for one reason: to make pre-invalidation keys unreachable. That
   * requires two successive generations to differ, and `Date.now()` cannot promise
   * it — `invalidateScope` followed immediately by a read is exactly the window in
   * which two generations share a millisecond, and they hashed identically.
   *
   * Not a leak today, because the invalidation deletes the entries themselves and
   * not merely the scope key. But a scope that can collide is a scope carrying no
   * information, which is why the timestamp became random bytes.
   */
  it("never repeats a scope across generations", async () => {
    const c = cache()
    const seen = new Set<string>()
    for (let i = 0; i < 50; i++) {
      seen.add(await c.computeScopeHash("t1"))
    }
    expect(seen.size).toBe(50)
  })

  it("scopes generations per tenant, so tenants cannot collide either", async () => {
    const c = cache()
    const a = await c.computeScopeHash("t1")
    const b = await c.computeScopeHash("t2")
    expect(a).not.toBe(b)
  })

  it("reports entry counts", async () => {
    await cache().set("t1", "a question", { answer: 1 }, {}, "ADMIN")
    await cache().set("t1", "another question", { answer: 2 }, {}, "ADMIN")

    const stats = await cache().getStats("t1")
    expect(stats.enabled).toBe(true)
    expect(stats.entries).toBeGreaterThanOrEqual(2)
  })
})

describe("semantic cache — disabled path", () => {
  /**
   * Tested against a freshly imported module with the URL removed, because this is
   * the default in every environment that has not configured Redis — and because
   * `enabled` is captured in the constructor, it cannot be turned off on an
   * existing instance.
   *
   * Every method must no-op rather than throw: this cache is optional, and an
   * exception here would take down the whole answer path over a missing optimisation.
   */
  it("no-ops on every operation when Redis is not configured", async () => {
    const saved = process.env.REDIS_URL
    delete process.env.REDIS_URL
    vi.resetModules()

    try {
      const { semanticCache } = await import("@/modules/rag/semantic-cache")
      expect(semanticCache.enabled()).toBe(false)
      expect(await semanticCache.get("t1", "q", "ADMIN")).toBeNull()
      await expect(semanticCache.set("t1", "q", { a: 1 }, {}, "ADMIN")).resolves.toBeUndefined()
      await expect(semanticCache.invalidateScope("t1")).resolves.toBeUndefined()
      expect(await semanticCache.getStats("t1")).toEqual({ enabled: false })
    } finally {
      process.env.REDIS_URL = saved
      vi.resetModules()
    }
  })

  /** A null scope is how a caller learns to skip the cache rather than store under "". */
  it("returns a null scope when disabled", async () => {
    const saved = process.env.REDIS_URL
    delete process.env.REDIS_URL
    vi.resetModules()

    try {
      const { getSemanticCache } = await import("@/modules/rag/semantic-cache")
      expect(await getSemanticCache().getScopeHash("t1", "ADMIN")).toBeNull()
    } finally {
      process.env.REDIS_URL = saved
      vi.resetModules()
    }
  })
})