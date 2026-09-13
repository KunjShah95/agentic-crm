/**
 * Two-Level Answer Cache (Exact + Semantic)
 * L1 = exact query hash. Backed by Redis when REDIS_URL is set,
 * else an in-memory Map (single instance / dev).
 * Entries are namespaced per tenant + a per-tenant version counter,
 * so invalidateTenant() cheaply drops all of a tenant's cached answers
 * when any document changes.
 *
 * Surgical invalidation: every cached answer records the document ids it cited
 * (trackCacheEntry). invalidateDocuments() bumps the tenant version only when
 * one of the changed docs actually appears in a cached answer's citation set;
 * otherwise the cached answers stay warm. Falls back to a full tenant bump when
 * no citation index exists (safe default).
 */

import crypto from "crypto";

let redis: any = null;

async function initRedis() {
  if (redis) return redis;
  try {
    const { createClient } = await import("redis");
    const client = createClient({ url: process.env.REDIS_URL });
    client.on("error", (err: Error) => console.warn("Redis error:", err));
    await client.connect();
    redis = client;
  } catch {
    redis = null;
  }
  return redis;
}

interface RedisClient {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, options?: { EX?: number }): Promise<void>;
  incr(key: string): Promise<number>;
  smembers(key: string): Promise<string[]>;
  sadd(key: string, member: string): Promise<number>;
  del(...keys: string[]): Promise<number>;
  scanIterator(options: { MATCH: string; COUNT: number }): AsyncIterable<string>;
  isOpen: boolean;
  connect(): Promise<void>;
}

const mem = new Map<string, { val: unknown; exp: number }>();
const TTL_SEC = Number(process.env.RAG_CACHE_TTL || 3600);

const verKey = (tenantId: string) => `rag:ver:${tenantId}`;

const getVersion = async (tenantId: string): Promise<string> => {
  const client = await initRedis();
  if (client) {
    try {
      return (await client.get(verKey(tenantId))) || "0";
    } catch {
      /* fall through */
    }
  }
  return String(mem.get(verKey(tenantId)) || 0);
};

export const cacheKey = async (tenantId: string, query: string, cfg: Record<string, unknown> = {}): Promise<string> => {
  const ver = await getVersion(tenantId);
  const h = crypto.createHash("sha256").update(JSON.stringify({ query, cfg })).digest("hex").slice(0, 32);
  return `rag:ans:${tenantId}:${ver}:${h}`;
};

export const getCached = async <T>(key: string): Promise<T | null> => {
  try {
    const client = await initRedis();
    if (client) {
      const v = await client.get(key);
      return v ? JSON.parse(v) : null;
    }
    const e = mem.get(key);
    if (!e) return null;
    if (e.exp < Date.now()) {
      mem.delete(key);
      return null;
    }
    return e.val as T;
  } catch {
    return null;
  }
};

export const setCached = async (key: string, val: unknown): Promise<void> => {
  try {
    const client = await initRedis();
    if (client) await client.set(key, JSON.stringify(val), { EX: TTL_SEC });
    else mem.set(key, { val, exp: Date.now() + TTL_SEC * 1000 });
  } catch (e) {
    console.warn("rag/cache set failed", { err: (e as Error).message });
  }
};

export const invalidateTenant = async (tenantId: string): Promise<void> => {
  try {
    const client = await initRedis();
    if (client) await client.incr(verKey(tenantId));
    else {
      const current = mem.get(verKey(tenantId));
      const val = (current?.val as number) || 0;
      mem.set(verKey(tenantId), { val: val + 1, exp: Date.now() + TTL_SEC * 1000 });
    }
  } catch (e) {
    console.warn("rag/cache invalidate failed", { err: (e as Error).message });
  }
};

const docsKey = (cacheEntryKey: string) => `rag:docs:${cacheEntryKey}`;

export const trackCacheEntry = async (entryKey: string, documentIds: string[] = []): Promise<void> => {
  if (!entryKey || !documentIds.length) return;
  try {
    const ids = [...new Set(documentIds.map(String))];
    const client = await initRedis();
    if (client) {
      await client.set(docsKey(entryKey), JSON.stringify(ids), { EX: TTL_SEC });
      for (const id of ids) await client.sadd(`rag:bydoc:${id}`, entryKey);
    } else {
      mem.set(docsKey(entryKey), { val: ids, exp: Date.now() + TTL_SEC * 1000 });
      for (const id of ids) {
        const k = `rag:bydoc:${id}`;
        const cur = (mem.get(k)?.val as string[]) || [];
        mem.set(k, { val: [...new Set([...cur, entryKey])], exp: Date.now() + TTL_SEC * 1000 });
      }
    }
  } catch (e) {
    console.warn("rag/cache track failed", { err: (e as Error).message });
  }
};

export const invalidateDocuments = async (tenantId: string, documentIds: string[] = []): Promise<{ invalidated: boolean; mode: string }> => {
  const ids = [...new Set((documentIds || []).map(String))].filter(Boolean);
  if (!ids.length) return { invalidated: false, mode: "none" };
  try {
    let touched = false;
    const client = await initRedis();
    if (client) {
      for (const id of ids) {
        const members = await client.smembers(`rag:bydoc:${id}`).catch(() => []);
        if (members?.length) {
          touched = true;
          break;
        }
      }
    } else {
      for (const id of ids) {
        const cur = (mem.get(`rag:bydoc:${id}`)?.val as string[]) || [];
        if (cur?.length) {
          touched = true;
          break;
        }
      }
    }
    if (touched) {
      await invalidateTenant(tenantId);
      return { invalidated: true, mode: "tenant-bump" };
    }
    return { invalidated: false, mode: "warm" };
  } catch {
    await invalidateTenant(tenantId);
    return { invalidated: true, mode: "fallback" };
  }
};