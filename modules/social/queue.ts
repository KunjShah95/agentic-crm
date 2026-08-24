/**
 * BullMQ queue singleton for social ingest.
 * Uses REDIS_URL (Upstash) when available; falls back to in-memory queue for dev/test.
 * Includes rate-limit (token bucket), retry with delay, DLQ after 5 attempts.
 */

export const DLQ_MAX_ATTEMPTS = 5

export class RateLimitedError extends Error {
  status = 429
  retryAfter?: number
  constructor(message = "Rate limited", retryAfter?: number) {
    super(message)
    this.name = "RateLimitedError"
    this.retryAfter = retryAfter
  }
}

export type SocialQueueJobOptions = {
  jobId?: string
  attempts?: number
  backoff?: { type: "exponential" | "fixed"; delay: number }
  removeOnComplete?: boolean
  removeOnFail?: boolean
  delay?: number
}

export type SocialQueueData = {
  provider: string
  normalized: import("./types").SocialNormalized
  raw?: unknown
}

export interface SocialQueue {
  add(name: string, data: SocialQueueData, opts?: SocialQueueJobOptions): Promise<{ id: string }>
}

/**
 * Determine if an error should be requeued (retryable).
 * Returns true for 429 / RateLimitedError / retryable status codes.
 */
export function shouldRequeue(error: unknown): boolean {
  if (!error || typeof error !== "object") return false
  const e = error as Record<string, unknown>
  if (e instanceof RateLimitedError) return true
  if (e["name"] === "RateLimitedError") return true
  const status = (e["status"] as number | undefined) ?? (e["statusCode"] as number | undefined) ?? (e["code"] === "RATE_LIMITED" ? 429 : undefined)
  if (status === 429) return true
  if (typeof e["code"] === "string" && e["code"] === "RATE_LIMITED") return true
  const response = e["response"] as Record<string, unknown> | undefined
  if (response) {
    const rStatus = (response["status"] as number | undefined) ?? ((response["statusCode"] as number | undefined))
    if (rStatus === 429) return true
  }
  if (typeof e["retryAfter"] === "number") return true
  return false
}

/**
 * Compute retry delay in milliseconds.
 * If error has retryAfter (seconds), use that; otherwise exponential backoff capped at 60s.
 */
export function getRetryDelay(error: unknown, attempt = 0): number {
  if (error && typeof error === "object") {
    const e = error as Record<string, unknown>
    const ra = e["retryAfter"] as unknown
    if (typeof ra === "number" && Number.isFinite(ra)) {
      return ra * 1000
    }
    if (typeof ra === "string" && /^\d+$/.test(ra)) {
      return parseInt(ra, 10) * 1000
    }
    const headers = (e["headers"] as Record<string, string> | undefined) ?? (e["response"] as Record<string, unknown> | undefined)?.["headers"] as Record<string, string> | undefined
    if (headers) {
      const val = headers["retry-after"] ?? headers["Retry-After"] ?? headers["retryAfter"]
      if (val !== undefined) {
        const parsed = typeof val === "string" ? parseInt(val, 10) : (val as unknown as number)
        if (Number.isFinite(parsed)) return parsed * 1000
      }
    }
  }
  const base = 1000
  const exp = base * Math.pow(2, attempt)
  return Math.min(exp, 60000)
}

// --- DLQ (Dead Letter Queue) ---

export type DLQEntry = {
  id: string
  provider: string
  data: SocialQueueData
  error: string
  attempts: number
  failedAt: string
}

const inMemoryDLQ: DLQEntry[] = []

export function _getDLQForTests(): DLQEntry[] {
  return [...inMemoryDLQ]
}

export function _resetDLQForTests() {
  inMemoryDLQ.length = 0
}

export function _removeFromDLQForTests(id: string) {
  const idx = inMemoryDLQ.findIndex((e) => e.id === id)
  if (idx !== -1) inMemoryDLQ.splice(idx, 1)
}

export function moveToDLQ(entry: DLQEntry) {
  const existing = inMemoryDLQ.find((e) => e.id === entry.id)
  if (existing) return existing
  inMemoryDLQ.push(entry)
  return entry
}

// --- Redis token bucket (provider:workspaceId) with in-memory fallback ---

type BucketState = { tokens: number; resetAt: number }
const memoryBuckets = new Map<string, BucketState>()

const BUCKET_CAPACITY = 60
const BUCKET_WINDOW_MS = 60_000

function bucketKey(provider: string, workspaceId: string): string {
  return `ratelimit:${provider}:${workspaceId}`
}

/**
 * Check rate limit using Redis token bucket if available, otherwise in-memory.
 * On exceeded, throws RateLimitedError with retryAfter seconds.
 */
export async function checkRateLimit(provider: string, workspaceId: string): Promise<void> {
  const key = bucketKey(provider, workspaceId)

  const upstashUrl = process.env.UPSTASH_REDIS_REST_URL
  const upstashToken = process.env.UPSTASH_REDIS_REST_TOKEN
  if (upstashUrl && upstashToken) {
    try {
      const res = await fetch(`${upstashUrl}/pipeline`, {
        method: "POST",
        headers: { Authorization: `Bearer ${upstashToken}`, "Content-Type": "application/json" },
        body: JSON.stringify([
          ["INCR", key],
          ["PTTL", key],
        ]),
      })
      if (res.ok) {
        const data = (await res.json()) as Array<{ result: number }>
        const count = data?.[0]?.result ?? 0
        const pttl = data?.[1]?.result ?? -1
        if (count === 1) {
          await fetch(`${upstashUrl}/pexpire`, {
            method: "POST",
            headers: { Authorization: `Bearer ${upstashToken}`, "Content-Type": "application/json" },
            body: JSON.stringify([key, BUCKET_WINDOW_MS]),
          })
        }
        if (count > BUCKET_CAPACITY) {
          const retryAfterSec = pttl > 0 ? Math.ceil(pttl / 1000) : Math.ceil(BUCKET_WINDOW_MS / 1000)
          throw new RateLimitedError(`Rate limit exceeded for ${provider}:${workspaceId}`, retryAfterSec)
        }
        return
      }
    } catch (e) {
      if (e instanceof RateLimitedError) throw e
      console.warn("[rate-limit] Upstash REST failed, falling back to memory", (e as Error).message)
    }
  }

  const redisUrl = process.env.REDIS_URL ?? process.env.UPSTASH_REDIS_URL ?? ""
  if (redisUrl) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const IORedis = require("ioredis") as unknown as new (url: string, opts: unknown) => unknown
      const client = new (IORedis as unknown as new (url: string, opts: Record<string, unknown>) => { incr: (k: string) => Promise<number>; pttl: (k: string) => Promise<number>; pexpire: (k: string, ms: number) => Promise<number> })(redisUrl, {
        maxRetriesPerRequest: 1,
        enableReadyCheck: false,
        lazyConnect: true,
      }) as unknown as { incr: (k: string) => Promise<number>; pttl: (k: string) => Promise<number>; pexpire: (k: string, ms: number) => Promise<number>; quit: () => Promise<void> }
      const maybeConnect = client as unknown as { connect: () => Promise<void> }
      try { await maybeConnect.connect() } catch { /* already connected */ }
      const count = await client.incr(key)
      const pttl = await client.pttl(key)
      if (count === 1) {
        await client.pexpire(key, BUCKET_WINDOW_MS)
      }
      if (count > BUCKET_CAPACITY) {
        const retryAfterSec = pttl > 0 ? Math.ceil(pttl / 1000) : Math.ceil(BUCKET_WINDOW_MS / 1000)
        try { await client.quit() } catch {}
        throw new RateLimitedError(`Rate limit exceeded for ${provider}:${workspaceId}`, retryAfterSec)
      }
      try { await client.quit() } catch {}
      return
    } catch (e) {
      if (e instanceof RateLimitedError) throw e
      console.warn("[rate-limit] Redis check failed, falling back to memory", (e as Error).message)
    }
  }

  const now = Date.now()
  let state = memoryBuckets.get(key)
  if (!state || now >= state.resetAt) {
    state = { tokens: BUCKET_CAPACITY, resetAt: now + BUCKET_WINDOW_MS }
    memoryBuckets.set(key, state)
  }
  if (state.tokens <= 0) {
    const retryAfterSec = Math.ceil((state.resetAt - now) / 1000)
    throw new RateLimitedError(`Rate limit exceeded for ${provider}:${workspaceId}`, retryAfterSec)
  }
  state.tokens -= 1
}

export function _resetRateLimitForTests() {
  memoryBuckets.clear()
}

export function _getRateLimitBucketsForTests() {
  return new Map(memoryBuckets)
}

// In-memory store for dev/test — exported for inspection
const inMemoryJobs: Array<{ name: string; data: SocialQueueData; opts?: SocialQueueJobOptions; id: string }> = []

class InMemoryQueue implements SocialQueue {
  async add(name: string, data: SocialQueueData, opts?: SocialQueueJobOptions): Promise<{ id: string }> {
    const id = opts?.jobId ?? `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    const existing = inMemoryJobs.find((j) => j.id === id)
    if (existing) {
      return { id: existing.id }
    }
    inMemoryJobs.push({ name, data, opts, id })
    if (process.env.NODE_ENV !== "test") {
      console.log(`[social queue:in-memory] enqueued ${name} jobId=${id} provider=${data.provider} delay=${opts?.delay ?? 0}`)
    }
    return { id }
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let bullQueue: any | null = null
let queueInstance: SocialQueue | null = null
let warnedNoRedis = false

function tryCreateBullMQ(): SocialQueue | null {
  const redisUrl = process.env.REDIS_URL ?? process.env.UPSTASH_REDIS_URL ?? ""
  if (!redisUrl) return null
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const bullmq = require("bullmq") as unknown as { Queue: new (...args: unknown[]) => unknown }
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const IORedis = require("ioredis") as unknown as new (url: string, opts: unknown) => unknown
    if (!bullQueue) {
      const connection = new (IORedis as unknown as new (url: string, opts: Record<string, unknown>) => unknown)(redisUrl, {
        maxRetriesPerRequest: null,
        enableReadyCheck: false,
      })
      const QueueCtor = bullmq.Queue as unknown as new (name: string, opts: Record<string, unknown>) => { on: (ev: string, fn: (e: Error) => void) => void; add: (name: string, data: unknown, opts: unknown) => Promise<{ id?: string }> }
      bullQueue = new QueueCtor("social-ingest", {
        connection,
        defaultJobOptions: {
          removeOnComplete: 100,
          removeOnFail: 50,
        },
      }) as unknown
      ;(bullQueue as { on: (ev: string, fn: (e: Error) => void) => void }).on("error", (err: Error) => {
        console.error("[social queue:bullmq] error", err)
      })
    }

    const wrapped: SocialQueue = {
      async add(name: string, data: SocialQueueData, opts?: SocialQueueJobOptions) {
        const res = await (bullQueue as { add: (name: string, data: unknown, opts: unknown) => Promise<{ id?: string }> }).add(name, data, {
          jobId: opts?.jobId,
          attempts: opts?.attempts ?? 5,
          backoff: opts?.backoff ?? { type: "exponential", delay: 2000 },
          delay: opts?.delay,
          removeOnComplete: opts?.removeOnComplete,
          removeOnFail: opts?.removeOnFail,
        })
        return { id: String(res.id ?? opts?.jobId ?? "") }
      },
    }
    return wrapped
  } catch (e) {
    console.warn("[social queue] BullMQ not available or failed to init, falling back to in-memory", (e as Error).message)
    return null
  }
}

export function getQueue(): SocialQueue {
  if (queueInstance) return queueInstance
  const bull = tryCreateBullMQ()
  if (bull) {
    queueInstance = bull
    return queueInstance
  }
  if (!warnedNoRedis && process.env.NODE_ENV !== "test") {
    console.warn("[social queue] REDIS_URL not set or BullMQ unavailable — using in-memory queue (dev only)")
    warnedNoRedis = true
  }
  queueInstance = new InMemoryQueue()
  return queueInstance
}

export async function handleJobFailure(
  job: { id: string; attemptsMade: number; data: SocialQueueData },
  error: unknown
): Promise<{ requeued: boolean; dlq: boolean; delay?: number }> {
  const attemptsMade = job.attemptsMade ?? 0
  const nextAttempt = attemptsMade + 1
  if (shouldRequeue(error) && nextAttempt < DLQ_MAX_ATTEMPTS) {
    const delay = getRetryDelay(error, attemptsMade)
    const queue = getQueue()
    await queue.add(job.data?.provider ? "social-ingest" : "social-ingest", job.data, {
      jobId: job.id,
      attempts: DLQ_MAX_ATTEMPTS,
      backoff: { type: "exponential", delay },
      delay,
    } as SocialQueueJobOptions & { delay?: number })
    return { requeued: true, dlq: false, delay }
  }
  if (nextAttempt >= DLQ_MAX_ATTEMPTS) {
    moveToDLQ({
      id: job.id,
      provider: job.data?.provider ?? "unknown",
      data: job.data,
      error: error instanceof Error ? error.message : String(error),
      attempts: nextAttempt,
      failedAt: new Date().toISOString(),
    })
    return { requeued: false, dlq: true }
  }
  return { requeued: false, dlq: false }
}

// Test helpers — not for production use
export function _resetQueueForTests() {
  inMemoryJobs.length = 0
  queueInstance = null
}

export function _getJobsForTests() {
  return [...inMemoryJobs]
}

export function _setQueueForTests(q: SocialQueue) {
  queueInstance = q
}
