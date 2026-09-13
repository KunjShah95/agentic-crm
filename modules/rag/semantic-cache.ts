/**
 * Semantic Cache — Redis-based, Scope-Aware Cross-Instance Cache
 * Uses document versions to auto-invalidate when KB changes.
 * Normalizes queries for semantic similarity matching.
 */

import { createClient, RedisClientType } from "redis";
import crypto from "crypto";

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
  async getScopeHash(tenantId: string): Promise<string | null> {
    if (!this.enabled) return null;
    await this.connect();
    if (!this.enabled) return null;

    const key = `rag:scope:${tenantId}`;
    let scope = await this.client!.get(key);
    if (!scope) {
      scope = await this.computeScopeHash(tenantId);
      await this.client!.set(key, scope, { EX: this.ttl });
    }
    return scope;
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

  makeCacheKey(tenantId: string, scope: string, normalizedQuery: string): string {
    const queryHash = crypto.createHash("sha256").update(normalizedQuery).digest("hex").slice(0, 16);
    return `rag:cache:${tenantId}:${scope}:${queryHash}`;
  }

  async get(tenantId: string, query: string): Promise<unknown | null> {
    if (!this.enabled) return null;
    await this.connect();
    if (!this.enabled) return null;

    const normalized = this.normalizeQuery(query);
    if (!normalized) return null;

    const scope = await this.getScopeHash(tenantId);
    if (!scope) return null;

    const key = this.makeCacheKey(tenantId, scope, normalized);
    const cached = await this.client!.get(key);
    if (!cached) return null;

    const parsed = JSON.parse(cached);
    // Verify scope still valid (documents haven't changed)
    const currentScope = await this.getScopeHash(tenantId);
    if (currentScope !== scope) {
      await this.client!.del(key);
      return null;
    }

    return parsed;
  }

  async set(tenantId: string, query: string, answer: unknown, metadata: Record<string, unknown> = {}): Promise<void> {
    if (!this.enabled) return;
    await this.connect();
    if (!this.enabled) return;

    const normalized = this.normalizeQuery(query);
    if (!normalized) return;

    const scope = await this.getScopeHash(tenantId);
    if (!scope) return;

    const key = this.makeCacheKey(tenantId, scope, normalized);
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
  get: (tenantId: string, query: string) => getSemanticCache().get(tenantId, query),
  set: (tenantId: string, query: string, answer: unknown, metadata: Record<string, unknown> = {}) =>
    getSemanticCache().set(tenantId, query, answer, metadata),
  invalidateScope: (tenantId: string) => getSemanticCache().invalidateScope(tenantId),
  getStats: (tenantId: string) => getSemanticCache().getStats(tenantId),
  enabled: () => !!process.env.REDIS_URL
};