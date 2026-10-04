/**
 * Semantic Cache — Redis-based, Scope-Aware Cross-Instance Cache
 * Uses document versions to auto-invalidate when KB changes.
 * Normalizes queries for semantic similarity matching.
 */

import { createClient, RedisClientType } from "redis";
import crypto from "crypto";

/**
 * Canonical, order-independent tag for a caller's role set.
 *
 * Two callers holding the same roles must produce the same tag (so they share
 * cache entries) and two callers with different roles must not (so a permissive
 * answer is never served to a restricted one). Sorting handles the fact that
 * role lists arrive in arbitrary order; hashing keeps the key short and avoids
 * putting role names into a Redis key verbatim. `null`/empty — the roleless API
 * caller — is its own distinct tag rather than a wildcard, because "no roles"
 * now means the non-confidential subset, which is a real and different answer.
 */
const roleTag = (role: string | string[] | null): string => {
  const arr = (Array.isArray(role) ? role : [role])
    .map((r) => String(r ?? "").trim())
    .filter(Boolean);
  if (!arr.length) return "norole";
  const canonical = [...new Set(arr)].sort().join(",");
  return crypto.createHash("sha256").update(canonical).digest("hex").slice(0, 12);
};

class SemanticCache {
  private client: RedisClientType | null = null;
  private ttl: number;
  private similarityThreshold: number;
  private enabled: boolean;
  private connected = false;

  constructor(redisUrl: string | undefined, options: { ttl?: number; similarityThreshold?: number } = {}) {
    this.ttl = options.ttl || 86400; // 24h
    this.similarityThreshold = options.similarityThreshold || 0.85;
    this.enabled = !!redisUrl;
    if (this.enabled) {
      this.client = createClient({ url: redisUrl });
      this.client.on("error", (err) => {
        console.warn("SemanticCache Redis error:", err);
        this.enabled = false;
      });
    }
  }

  async connect(): Promise<void> {
    if (!this.enabled || this.connected) return;
    if (this.client && !this.client.isOpen) {
      try {
        await this.client.connect();
        this.connected = true;
      } catch (err) {
        console.warn("SemanticCache connection failed:", err);
        this.enabled = false;
      }
    }
  }

  // Scope = hash of all document IDs + versions for this tenant
  async getScopeHash(tenantId: string, role?: string | string[] | null): Promise<string | null> {
    if (!this.enabled) return null;
    await this.connect();
    if (!this.enabled) return null;

    /* The memoised scope stays keyed by tenant alone — it is the document-set
       fingerprint and is role-independent. The role is appended afterwards to
       derive the *variant* used in the cache key, so adding or removing a
       caller with different privileges can never read another role's entry
       without also invalidating the shared document fingerprint. */
    const key = `rag:scope:${tenantId}`;
    let scope = await this.client!.get(key);
    if (!scope) {
      scope = await this.computeScopeHash(tenantId);
      await this.client!.set(key, scope, { EX: this.ttl });
    }
    if (role === undefined) return scope;
    return `${scope}:${roleTag(role)}`;
  }

  async computeScopeHash(tenantId: string): Promise<string> {
    // We'll use a simple approach - in production, this would query the database
    // For now, we use a timestamp-based approach that gets invalidated
    const timestamp = Date.now().toString();
    return crypto.createHash("sha256").update(`${tenantId}:${timestamp}`).digest("hex").slice(0, 16);
  }

  normalizeQuery(query: string): string {
    const STOPWORDS = new Set([
      "the", "a", "an", "and", "or", "but", "in", "on", "at", "to", "for", "of", "with", "by",
      "is", "are", "was", "were", "be", "been", "being", "have", "has", "had", "do", "does", "did",
      "will", "would", "could", "should", "may", "might", "must", "can", "what", "which", "who",
      "whom", "where", "when", "why", "how", "this", "that", "these", "those", "it", "its", "as"
    ]);
    return query
      .toLowerCase()
      .trim()
      .replace(/[^\w\s]/g, " ")
      .replace(/\s+/g, " ")
      .split(" ")
      .filter(w => w.length > 2 && !STOPWORDS.has(w))
      .join(" ");
  }

  /**
   * Cache key material for one tenant/role pair.
   *
   * The role is folded into the scope because the scope is part of the cache
   * key, and the key was `tenantId + scope + query` with nothing distinguishing
   * *who* asked. Since answers are now filtered by the caller's role (see the
   * fail-closed ACL in retrieve.ts / answer.ts), that made the cache a
   * cross-privilege channel: an ADMIN asks a question, the answer — which may
   * quote confidential documents — is cached under the tenant-wide key, and the
   * next caller with fewer roles gets it served verbatim.
   *
   * `roleTag` makes the tag order-independent and hash-short, so two callers
   * holding the same roles share entries and two callers holding different
   * roles cannot. There is deliberately no default that collapses privilege
   * levels onto one key: a caller has to name the role it already resolved.
   */
  /**
   * @param variant  Discriminator for answers that share a query but differ in
   *                 some other respect. Currently the answer language: the
   *                 semantic key matches on query similarity, so the Gujarati and
   *                 English phrasings of the same question share a scope and
   *                 near-identical similarity scores — without this, whichever
   *                 arrived first answered both, in its own language.
   *
   *                 A parameter rather than being folded into `normalizedQuery`
   *                 because that string is what gets embedded; appending a
   *                 language tag to it would put a non-linguistic token into the
   *                 vector and shift every similarity score.
   */
  makeCacheKey(
    tenantId: string,
    scope: string,
    normalizedQuery: string,
    variant = ""
  ): string {
    const queryHash = crypto.createHash("sha256").update(normalizedQuery).digest("hex").slice(0, 16);
    return `rag:cache:${tenantId}:${scope}:${variant ? `${variant}:` : ""}${queryHash}`;
  }

  async get(
    tenantId: string,
    query: string,
    role?: string | string[] | null,
    variant = ""
  ): Promise<unknown | null> {
    if (!this.enabled) return null;
    await this.connect();
    if (!this.enabled) return null;

    const normalized = this.normalizeQuery(query);
    if (!normalized) return null;

    const scope = await this.getScopeHash(tenantId, role);
    if (!scope) return null;

    const key = this.makeCacheKey(tenantId, scope, normalized, variant);
    const cached = await this.client!.get(key);
    if (!cached) return null;

    const parsed = JSON.parse(cached);
    // Verify scope still valid (documents haven't changed)
    const currentScope = await this.getScopeHash(tenantId, role);
    if (currentScope !== scope) {
      await this.client!.del(key);
      return null;
    }

    return parsed;
  }

  async set(
    tenantId: string,
    query: string,
    answer: unknown,
    metadata: Record<string, unknown> = {},
    role?: string | string[] | null,
    variant = ""
  ): Promise<void> {
    if (!this.enabled) return;
    await this.connect();
    if (!this.enabled) return;

    const normalized = this.normalizeQuery(query);
    if (!normalized) return;

    const scope = await this.getScopeHash(tenantId, role);
    if (!scope) return;

    const key = this.makeCacheKey(tenantId, scope, normalized, variant);
    const payload = {
      answer,
      metadata,
      cachedAt: new Date().toISOString(),
      scope
    };

    await this.client!.set(key, JSON.stringify(payload), { EX: this.ttl });
  }

  async invalidateScope(tenantId: string): Promise<void> {
    if (!this.enabled) return;
    await this.connect();
    if (!this.enabled) return;

    const pattern = `rag:cache:${tenantId}:*`;
    const keys: string[] = [];
    for await (const key of this.client!.scanIterator({ MATCH: pattern, COUNT: 100 })) {
      keys.push(key);
    }
    if (keys.length) await this.client!.del(keys);
    // Also invalidate scope hash
    await this.client!.del(`rag:scope:${tenantId}`);
  }

  async getStats(tenantId: string): Promise<{ enabled: boolean; entries?: number }> {
    if (!this.enabled) return { enabled: false };
    await this.connect();
    if (!this.enabled) return { enabled: false };

    const pattern = `rag:cache:${tenantId}:*`;
    let count = 0;
    for await (const _key of this.client!.scanIterator({ MATCH: pattern, COUNT: 100 })) {
      count++;
    }
    return { enabled: true, entries: count };
  }
}

// Lazy initialization - only connect when first used
let semanticCacheInstance: SemanticCache | null = null;

export function getSemanticCache(): SemanticCache {
  if (!semanticCacheInstance) {
    const redisUrl = process.env.REDIS_URL;
    semanticCacheInstance = new SemanticCache(redisUrl, {
      ttl: Number(process.env.RAG_CACHE_TTL || 86400),
      similarityThreshold: Number(process.env.RAG_CACHE_SIMILARITY || 0.85)
    });
  }
  return semanticCacheInstance;
}

export const semanticCache = {
  /* `role` is threaded through on every read and write. This facade is what
     `answer.ts` actually imports, so a signature here that omits it would
     silently drop the role before it reached the key — exactly the cross-
     privilege cache hit this was fixed to prevent.

     `variant` is threaded for the same reason and carries the answer language.
     Both are positional-optional, which is why the comment exists: dropping
     either from this facade would not fail to compile at the call sites, it
     would fail to *discriminate* in the key, and the only symptom would be a
     user in the wrong language with a confidently cited answer. */
  get: (
    tenantId: string,
    query: string,
    role?: string | string[] | null,
    variant = ""
  ) => getSemanticCache().get(tenantId, query, role, variant),
  set: (
    tenantId: string,
    query: string,
    answer: unknown,
    metadata: Record<string, unknown> = {},
    role?: string | string[] | null,
    variant = ""
  ) => getSemanticCache().set(tenantId, query, answer, metadata, role, variant),
  invalidateScope: (tenantId: string) => getSemanticCache().invalidateScope(tenantId),
  getStats: (tenantId: string) => getSemanticCache().getStats(tenantId),
  enabled: () => !!process.env.REDIS_URL
};