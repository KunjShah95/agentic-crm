import { describe, it, expect, vi, beforeEach } from "vitest"
import { readFileSync } from "node:fs"
import { join } from "node:path"

import { REPO_ROOT, scan } from "../helpers/source-scan"

/**
 * Corpus mutation must invalidate *both* answer caches.
 *
 * ## The failure this exists to prevent
 *
 * A freshly ingested compliance document could be invisible to the knowledge
 * base for the full 24h semantic-cache TTL, and the pipeline would answer around
 * it with a confident, fully-cited response drawn from before the document
 * existed. Nothing errored. The citation resolved. The answer was wrong.
 *
 * Three things had to be true for that to happen, and only fixing one of them
 * would have left the bug in place:
 *
 *  1. `ingestDocument` invalidated the exact-answer cache — but did so *too
 *     early*, while the document had chunks and no embeddings, so it was not yet
 *     retrievable and the flush bought nothing.
 *  2. Nothing on the ingest path invalidated the **semantic** cache at all. It
 *     is the worse of the two because it matches on query *similarity* rather
 *     than equality: a re-asked question in slightly different wording finds the
 *     stale entry even where the exact key would have missed.
 *  3. `computeScopeHash` reads like a change detector and is not one. It hashes
 *     `tenantId` with `Date.now()`, so it is stable for as long as the memoised
 *     value survives and does **not** move when a document is added, edited or
 *     deleted. The file docstring and the comment above the function both
 *     described the intended implementation rather than the code.
 *
 * (3) is why this suite exists as more than a unit test. A maintainer reading any
 * of those comments concludes invalidation is automatic and reasonably omits the
 * explicit call — which is precisely how the embedding queue ended up leaving the
 * semantic cache warm after every ingest. The structural cases below pin the
 * *timing* so the reasoning cannot have to be re-derived from prose.
 */

const invalidateScope = vi.hoisted(() => vi.fn())
vi.mock("@/modules/rag/semantic-cache", () => ({
  semanticCache: { invalidateScope },
}))

const {
  cacheKey,
  getCached,
  setCached,
  invalidateRetrievalCaches,
} = await import("@/modules/rag/cache")

const read = (rel: string): string => readFileSync(join(REPO_ROOT, rel), "utf8")

describe("invalidateRetrievalCaches", () => {
  beforeEach(() => {
    invalidateScope.mockReset().mockResolvedValue(undefined)
  })

  /**
   * The exact-answer half, behaviourally. `REDIS_URL` is unset under vitest, so
   * `initRedis` returns null and every operation lands in the module-level Map —
   * the same path as a Redis outage, which is the branch most likely to rot.
   *
   * The key is **recomputed** after invalidation rather than reused, because that
   * is the mechanism: `cacheKey` embeds `rag:ans:<tenant>:<ver>:<hash>` and
   * `invalidateTenant` increments `<ver>`. Old entries are not deleted, they
   * become unreachable — so a caller still holding a pre-invalidation key string
   * would keep hitting its entry, while every real caller recomputes per request.
   * Asserting on the recomputed key is what pins that contract, and the explicit
   * `not.toBe` below is what would catch the version dropping out of the key and
   * turning this whole mechanism into a no-op.
   */
  it("makes a previously cached answer unreachable", async () => {
    const before = await cacheKey("t1", "What is the refund window?", { topK: 8 })

    await setCached(before, { answer: "30 days", citations: ["doc-1"] })
    expect(await getCached(before)).toEqual({ answer: "30 days", citations: ["doc-1"] })

    await invalidateRetrievalCaches("t1")

    const after = await cacheKey("t1", "What is the refund window?", { topK: 8 });
    expect(after).not.toBe(before)
    expect(await getCached(after)).toBeNull()
  })

  it("leaves another tenant's cache alone", async () => {
    const mine = await cacheKey("t1", "refund window?", {})
    const theirs = await cacheKey("t2", "refund window?", {})
    await setCached(mine, "mine")
    await setCached(theirs, "theirs")

    await invalidateRetrievalCaches("t1")

    expect(await getCached(await cacheKey("t1", "refund window?", {}))).toBeNull()
    expect(await getCached(await cacheKey("t2", "refund window?", {}))).toBe("theirs")
  })

  /**
   * The semantic half, which has no version component and cannot be reached by
   * the assertion above. This is the half the ingest path skipped, and it is the
   * half that produces a plausible-looking wrong answer rather than a miss.
   */
  it("clears the semantic cache scope, which no version bump can reach", async () => {
    await invalidateRetrievalCaches("t1")
    expect(invalidateScope).toHaveBeenCalledWith("t1")
  })

  it("clears both caches even when the semantic scan fails", async () => {
    // The semantic cache scans and deletes keys; the exact cache is a version
    // bump. The two are independent mechanisms, so a failure in the scan must not
    // leave the version bump unapplied — otherwise one broken cache silently
    // reopens the stale-answer hole in the other.
    invalidateScope.mockRejectedValueOnce(new Error("redis down"))

    await expect(invalidateRetrievalCaches("t1")).rejects.toThrow("redis down")

    // The version moved despite the rejection, so the next request cannot read
    // anything cached before it.
    const key = await cacheKey("t1", "q", {});
    expect(await getCached(key)).toBeNull()
  })
})

describe("invalidation timing", () => {
  /**
   * Structural, and deliberately so. `processItem` in `queue.ts` is not exported
   * and runs behind a timer, so the call site cannot be reached by calling it —
   * the same constraint `broker-scope-registry` records for the hand-written SQL
   * in `modules/search`, where a structural check is the only honest option.
   *
   * Comments are excluded from the scan, so naming `invalidateRetrievalCaches` in
   * a comment is not a call.
   */
  it("is called from the embed worker, which is when content becomes retrievable", () => {
    const callers = scan(/invalidateRetrievalCaches\s*\(/, {
      roots: ["modules/rag"],
      includeComments: false,
    }).map((v) => v.file)

    expect(callers).toContain("modules/rag/queue.ts")
  })

  /**
   * The half that is easy to regress by accident. Re-adding the flush to
   * `ingestDocument` looks like hardening and is not: at that point the document
   * has no embeddings, so it cannot be retrieved and there is nothing for an
   * answer to be stale against.
   */
  it("is not called from ingest, which runs before the document is retrievable", () => {
    const callers = scan(/invalidateRetrievalCaches\s*\(/, {
      roots: ["modules/rag"],
      includeComments: false,
    }).map((v) => v.file)

    expect(callers).not.toContain("modules/rag/ingest.ts")
  })

  /**
   * `computeScopeHash` is named and documented like a change detector and is not
   * one. It must never start being read as the invalidation mechanism, because the
   * explicit call is the only thing keeping the semantic cache correct.
   *
   * Asserted against the **file header**, which is the part a reader reaches
   * first and the part that actually carried the false claim ("Uses document
   * versions to auto-invalidate when KB changes"). Quoting that sentence inside
   * `computeScopeHash`'s own comment in order to discredit it is fine and is not
   * what this asserts, so the match is anchored to the top-of-file docstring
   * rather than to the whole source.
   *
   * The honest version is "an opaque per-TTL token, do not rely on it to detect
   * change". A test demanding a real fingerprint would be demanding the *other*
   * fix — deriving it from `RagDocument.version` — which is a larger change than
   * this bug needs.
   */
  it("does not claim at the top of the file to detect corpus change", () => {
    const raw = read("modules/rag/semantic-cache.ts");
    const header = raw.slice(0, raw.indexOf("*/") + 2).replace(/\r?\n\s*\*/g, " ").replace(/\s+/g, " ")
    const flat = raw.replace(/\r?\n\s*\*/g, " ").replace(/\s+/g, " ")

    // Scoped to the header, which is the part a reader reaches first and the part
    // that carried the false claim. Scoped *and* affirmative-only because the
    // header now explicitly disclaims auto-invalidation, and `computeScopeHash`
    // quotes the old sentence in order to discredit it — so neither a bare
    // /auto-invalidate/ nor a whole-file match can tell a claim from a denial.
    expect(header).not.toMatch(/Uses document versions/i);
    expect(header).toMatch(/Does NOT auto-invalidate/i)

    // And the function's own comment is explicit about what the token is not.
    expect(flat).toMatch(/do not rely on it to detect change/i)
  })
})
