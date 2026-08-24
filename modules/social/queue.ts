/**
 * BullMQ queue singleton for social ingest.
 * Uses REDIS_URL (Upstash) when available; falls back to in-memory queue for dev/test.
 */

export type SocialQueueJobOptions = {
  jobId?: string
  attempts?: number
  backoff?: { type: "exponential" | "fixed"; delay: number }
  removeOnComplete?: boolean
  removeOnFail?: boolean
}

export type SocialQueueData = {
  provider: string
  normalized: import("./types").SocialNormalized
  raw?: unknown
}

export interface SocialQueue {
  add(name: string, data: SocialQueueData, opts?: SocialQueueJobOptions): Promise<{ id: string }>
}

// In-memory store for dev/test — exported for inspection
const inMemoryJobs: Array<{ name: string; data: SocialQueueData; opts?: SocialQueueJobOptions; id: string }> = []

class InMemoryQueue implements SocialQueue {
  async add(name: string, data: SocialQueueData, opts?: SocialQueueJobOptions): Promise<{ id: string }> {
    const id = opts?.jobId ?? `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    // Dedupe by jobId — if same id already exists, return existing without duplicating (BullMQ jobId dedupe semantics)
    const existing = inMemoryJobs.find((j) => j.id === id)
    if (existing) {
      return { id: existing.id }
    }
    inMemoryJobs.push({ name, data, opts, id })
    // In dev, optionally log; avoid noisy output in tests
    if (process.env.NODE_ENV !== "test") {
      console.log(`[social queue:in-memory] enqueued ${name} jobId=${id} provider=${data.provider}`)
    }
    return { id }
  }
}

// Optional BullMQ backing — lazy loaded via dynamic require to avoid hard dependency
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let bullQueue: any | null = null
let queueInstance: SocialQueue | null = null
let warnedNoRedis = false

function tryCreateBullMQ(): SocialQueue | null {
  const redisUrl = process.env.REDIS_URL ?? process.env.UPSTASH_REDIS_URL ?? ""
  if (!redisUrl) return null
  try {
    // Use dynamic require so build doesn't fail when bullmq/ioredis not installed
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const bullmq = require("bullmq") as unknown as { Queue: new (...args: unknown[]) => unknown }
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const IORedis = require("ioredis") as unknown as new (url: string, opts: unknown) => unknown

    // Reuse singleton connection
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

// Test helpers — not for production use
export function _resetQueueForTests() {
  inMemoryJobs.length = 0
  queueInstance = null
  // do not close bullQueue in tests — keep singleton; caller can reset if needed
}

export function _getJobsForTests() {
  return [...inMemoryJobs]
}

export function _setQueueForTests(q: SocialQueue) {
  queueInstance = q
}
