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

/**
 * The slice of the `redis` client this module uses.
 *
 * Declared here rather than importing the driver's types because `redis` is
 * loaded through a dynamic `import()` — it is optional, and a static import would
 * make the whole cache module fail to load when the package is absent. The
 * interface is the contract; the real client is structurally compatible with it.
 *
 * This was previously `let redis: any` with this very interface sitting
 * *unused* directly below. The cast was what allowed the module to compile while
 * the contract it was written against went unchecked — a typo like `client.ge`
 * would have typechecked and failed at runtime, on the first cache read, in
 * production.
 */
interface RedisClient {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, options?: { EX?: number }): Promise<void>;
  incr(key: string): Promise<number>;
  /* `sAdd` / `sMembers`, not `sadd` / `smembers`. node-redis v4 renamed the set
     commands to camelCase, so the lower-case names in the old interface did not
     exist on the client — and because the variable holding the client was `any`,
     the two call sites below that used the lower-case spelling compiled fine and
     would have thrown `client.sadd is not a function` on the first document
     cache invalidation. The names here match what the driver actually exposes. */
  sAdd(key: string, member: string): Promise<number>;
  sMembers(key: string): Promise<string[]>;
  del(...keys: string[]): Promise<number>;
  scanIterator(options: { MATCH: string; COUNT: number }): AsyncIterable<string>;
  isOpen: boolean;
  connect(): Promise<void>;
  on?(event: string, handler: (err: Error) => void): unknown;
}

let redis: RedisClient | null = null;

async function initRedis(): Promise<RedisClient | null> {
  if (redis) return redis;
  try {
    const { createClient } = await import("redis");
    /* One documented cast, at the single point the driver's own type meets this
       module's contract. `createClient` returns `RedisClientType<...modules...>`,
       whose module map and generic parameters cannot be reconciled with a
       structural interface — the driver type carries far more than this module
       uses, and none of the extras are called here.

       Every method this module actually invokes is declared on `RedisClient`
       above, so the cast cannot hide a missing or misspelled command: that is
       the property the untyped `let redis: any` did not have. */
    const client = createClient({ url: process.env.REDIS_URL }) as unknown as RedisClient;
    client.on?.("error", (err: Error) => console.warn("Redis error:", err));
    await client.connect();
    redis = client;
  } catch {
    redis = null;
  }
  return redis;
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
      for (const id of ids) await client.sAdd(`rag:bydoc:${id}`, entryKey);
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
  /* Trimmed before the blank check, not after.
     `filter(Boolean)` alone drops `""` but keeps `"  "` — whitespace is truthy — so
     a whitespace-only id passed the guard and went on to a reverse-index lookup
     that can never match. Harmless in effect, but it means the `mode: "none"`
     early return did not fire for input that was, in every practical sense,
     empty: the caller asked to invalidate nothing and got `"warm"` — a claim
     about cache state it had no way to interpret — instead. */
  const ids = [...new Set((documentIds || []).map((id) => String(id).trim()))].filter(Boolean);
  if (!ids.length) return { invalidated: false, mode: "none" };
  try {
    let touched = false;
    const client = await initRedis();
    if (client) {
      for (const id of ids) {
        const members = await client.sMembers(`rag:bydoc:${id}`).catch(() => []);
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