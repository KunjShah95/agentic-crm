/**
 * Shared HTTP + Rate-Limit-Aware Call Helper for Provider Pools
 * Providers are declared as { name, isEnabled(), call(payload) }. A pool tries
 * each enabled provider in order, cooling down any that return HTTP 429 (or throw),
 * and falls open to the next. If all fail, the pool's mock is used.
 */

const cooldowns = new Map<string, number>();
const COOLDOWN_MS = 30_000;

export const onRateLimit = (name: string) => cooldowns.set(name, Date.now() + COOLDOWN_MS);
const isCoolingDown = (name: string) => (cooldowns.get(name) || 0) > Date.now();

interface Provider<TIn, TOut> {
  name: string;
  isEnabled: () => boolean;
  call: (payload: TIn) => Promise<TOut>;
}

interface FetchOptions {
  method?: string;
  headers?: Record<string, string>;
  body?: string | object | FormData | null;
  timeoutMs?: number;
}

export const fetchJson = async <T>(url: string, { method = "POST", headers = {}, body, timeoutMs = 30_000 }: FetchOptions = {}): Promise<T> => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method,
      headers: { "content-type": "application/json", ...headers },
      body: body && typeof body !== "string" && !(body instanceof FormData) ? JSON.stringify(body) : (body as BodyInit | null),
      signal: controller.signal,
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      const err = new Error(`HTTP ${res.status} from ${url}: ${text.slice(0, 200)}`);
      (err as Error & { status?: number }).status = res.status;
      throw err;
    }
    return await res.json() as T;
  } finally {
    clearTimeout(timeout);
  }
};

export const runPool = async <TIn, TOut>(
  poolName: string,
  providers: Provider<TIn, TOut>[],
  payload: TIn,
  mock: (payload: TIn) => Promise<TOut>
): Promise<TOut & { providerUsed: string }> => {
  const enabled = providers.filter((p) => p.isEnabled() && !isCoolingDown(p.name));
  for (const p of enabled) {
    try {
      const out = await p.call(payload);
      return { ...out, providerUsed: p.name } as TOut & { providerUsed: string };
    } catch (e) {
      const status = (e as Error & { status?: number }).status;
      if (status === 429) onRateLimit(p.name);
      console.warn(`rag/${poolName}: provider ${p.name} failed (${status || "err"}), falling through`, {
        err: (e as Error).message,
      });
    }
  }
  console.warn(`rag/${poolName}: all providers unavailable, using mock`);
  return { ...(await mock(payload)), providerUsed: "mock" } as TOut & { providerUsed: string };
};