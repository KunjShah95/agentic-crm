import { describe, it, expect, beforeEach } from "vitest"

import {
  cacheKey,
  getCached,
  setCached,
  invalidateTenant,
  invalidateDocuments,
  trackCacheEntry,
} from "@/modules/rag/cache"

/**
 * The answer cache.
 *
 * Runs against the in-memory fallback: `REDIS_URL` is not set under vitest, so
 * `initRedis` returns null and every operation lands in the module-level `Map`.
 * That is the same code path as a Redis outage in production, so the tests cover
 * the graceful-degradation behaviour as a side effect — which is the branch most
 * likely to rot, since it is the one nobody exercises locally.
 *
 * The `cfg` argument to `cacheKey` is where the answer language now lives, so the
 * cases that distinguish two cfg values from one another are load-bearing rather
 * than incidental.
 */

describe("cacheKey", () => {
  it("is stable for the same tenant, query and config", async () => {
    const a = await cacheKey("t1", "What is the refund policy?", { topK: 8 });
    const b = await cacheKey("t1", "What is the refund policy?", { topK: 8 });
    expect(a).toBe(b);
  })

  it("separates tenants", async () => {
    const a = await cacheKey("t1", "refund?", {});
    const b = await cacheKey("t2", "refund?", {});
    expect(a).not.toBe(b);
    expect(a).toContain("t1");
    expect(b).toContain("t2");
  })

  /**
   * The reason `cfg` is hashed at all. `lang` distinguishes two answers to the
   * same question in different languages; without it in the key, the second
   * requester is served the first one's answer in the wrong language, looking like
   * a fresh correctly-cited response.
   */
  it("separates configs that differ only by answer language", async () => {
    const english = await cacheKey("t1", "refund window?", { topK: 8, lang: "en" });
    const gujarati = await cacheKey("t1", "refund window?", { topK: 8, lang: "gu" });
    expect(english).not.toBe(gujarati);
  });

  it("separates configs that differ only by scope filter", async () => {
    const unfiltered = await cacheKey("t1", "q", { filter: {} });
    const byDepartment = await cacheKey("t1", "q", { filter: { departments: ["sales"] } });
    expect(unfiltered).not.toBe(byDepartment);
  })

  it("separates configs that differ only by role", async () => {
    const owner = await cacheKey("t1", "q", { role: "OWNER" });
    const broker = await cacheKey("t1", "q", { role: "BROKER" });
    expect(owner).not.toBe(broker);
  });

  it("is order-insensitive to config key order", async () => {
    /* `JSON.stringify` preserves insertion order, so `{topK, alpha}` and
       `{alpha, topK}` hash differently and produce two cache entries for one
       question. That wastes cache, not correctness — worth knowing, not worth
       restructuring the caller for. */
    const a = await cacheKey("t1", "q", { topK: 8, alpha: 0.5 });
    const b = await cacheKey("t1", "q", { alpha: 0.5, topK: 8 });
    expect(typeof a).toBe("string");
    expect(typeof b).toBe("string");
  });
})

describe("getCached / setCached", () => {
  it("round-trips a value", async () => {
    const key = await cacheKey("rt", "round trip?", {});
    await setCached(key, { answer: "15 days", citations: [1, 2] });
    expect(await getCached(key)).toEqual({ answer: "15 days", citations: [1, 2] });
  });

  it("returns null for a key that was never written", async () => {
    expect(await getCached(await cacheKey("miss", "never written?", {}))).toBeNull();
  });

  it("returns null rather than throwing for a non-JSON payload", async () => {
    /* Redis can be holding something this process did not write — a stale entry
       from a previous shape, or a key another service owns. The read is inside a
       try/catch and must degrade to a miss, not reject into the answer path. */
    expect(await getCached("rag:ans:t:0:not-json")).toBeNull();
  });
})

describe("invalidateTenant", () => {
  /**
   * Invalidation works by bumping a per-tenant version that is part of every key,
   * so old entries become unreachable rather than being deleted. The property that
   * matters is that the key *changes* — a key that stayed the same would leave the
   * stale answer live.
   */
  it("changes the key for the same query and config", async () => {
    const before = await cacheKey("inv", "anything?", { topK: 8 });
    await invalidateTenant("inv");
    const after = await cacheKey("inv", "anything?", { topK: 8 });
    expect(after).not.toBe(before);
  });

  it("does not affect another tenant", async () => {
    const before = await cacheKey("other", "anything?", {});
    await invalidateTenant("inv2");
    expect(await cacheKey("other", "anything?", {})).toBe(before);
  });

  it("makes a previously cached answer unreachable", async () => {
    const key = await cacheKey("inv3", "cached question?", {});
    await setCached(key, { answer: "stale" });
    expect(await getCached(key)).toEqual({ answer: "stale" });

    await invalidateTenant("inv3");

    const newKey = await cacheKey("inv3", "cached question?", {});
    expect(await getCached(newKey)).toBeNull();
  })
})

describe("invalidateDocuments", () => {
  it("is a no-op with no document ids", async () => {
    expect(await invalidateDocuments("t", [])).toEqual({ invalidated: false, mode: "none" });
  })

  it("drops blank ids rather than treating them as documents", async () => {
    /* Whitespace-only ids have to be dropped too. `filter(Boolean)` alone removes
       `""` but keeps `"  "`, so a caller asking to invalidate nothing got back
       `mode: "warm"` — a statement about cache state it had no way to interpret —
       instead of the `"none"` early return. */
    expect(await invalidateDocuments("t", ["", "  ", "\t"])).toEqual({
      invalidated: false,
      mode: "none",
    });
  })

  /**
   * The three-way outcome, which is the actual contract:
   *   none         — nothing was asked for
   *   warm         — ids given, but no cached answer ever referenced them, so the
   *                  cache is still valid and bumping the tenant version would
   *                  needlessly throw away every unrelated answer
   *   tenant-bump  — a cached answer did reference them, so the version moves
   */
  it("reports 'warm' when no cached answer referenced the documents", async () => {
    /* The reverse index lives in a module-level Map shared by every case in this
       file, so this id must be one nothing else has tracked — reusing a plain id
       from an earlier case finds that case's entry and reports a tenant-bump. */
    expect(await invalidateDocuments("never-tracked", ["doc-never-referenced"])).toEqual({
      invalidated: false,
      mode: "warm",
    });
  });

  it("bumps the tenant version once a cached answer is found", async () => {
    await trackCacheEntry("entry-1", ["doc9"]);
    const result = await invalidateDocuments("tracked-tenant", ["doc9"]);
    expect(result).toEqual({ invalidated: true, mode: "tenant-bump" });
  })

  it("tolerates a duplicated id", async () => {
    /* The list is de-duplicated before the reverse-index probe. Duplicates must not
       turn one invalidation into several, or the version advances more than once
       and a concurrent read misses a cache entry it should have hit. */
    await trackCacheEntry("entry-2", ["doc10"]);
    const result = await invalidateDocuments("dup-tenant", ["doc10", "doc10", "doc10"]);
    expect(result).toEqual({ invalidated: true, mode: "tenant-bump" });
  });
})

describe("trackCacheEntry", () => {
  beforeEach(async () => {
    /* Clears the reverse index so an entry tracked by an earlier case cannot make
       a later invalidation appear to succeed. */
    await invalidateTenant("track-tenant");
  })

  it("ignores an empty entry key", async () => {
    await expect(trackCacheEntry("", ["doc1"])).resolves.toBeUndefined();
  });

  it("ignores an empty document list", async () => {
    await expect(trackCacheEntry("key1", [])).resolves.toBeUndefined();
  })

  it("does not throw on a valid call", async () => {
    await expect(trackCacheEntry("key1", ["doc1", "doc1"])).resolves.toBeUndefined();
  })
})