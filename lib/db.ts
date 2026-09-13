import { PrismaPg } from "@prisma/adapter-pg"
import { PrismaClient } from "@/lib/generated/prisma/client"

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient }

const SUPABASE_DIRECT_HOST = /^db\.([a-z0-9]+)\.supabase\.co$/i

/**
 * Supabase's direct database host (`db.<ref>.supabase.co`) resolves to IPv6
 * only. Vercel functions have no IPv6 egress, so Prisma queries fail at runtime
 * even though the same URL works from a local machine with IPv6 enabled. When
 * that shape is detected on Vercel, route it through the Supabase connection
 * pooler (IPv4, same credentials). Pointing `DATABASE_URL` at a pooled URL, or
 * setting `SUPABASE_POOLER_HOST`, skips this rewrite entirely.
 */
function resolveConnectionString(raw: string): string {
  if (!process.env.VERCEL) return raw
  try {
    const url = new URL(raw)
    const match = SUPABASE_DIRECT_HOST.exec(url.hostname)
    if (!match) return raw
    url.hostname = process.env.SUPABASE_POOLER_HOST ?? "aws-0-ap-south-1.pooler.supabase.com"
    url.port = "6543"
    url.username = `postgres.${match[1]}`
    return url.toString()
  } catch {
    return raw
  }
}

function createClient() {
  const connectionString = process.env.DATABASE_URL
  if (!connectionString) {
    // During unit tests (vitest) the real DB is not needed for pure-function modules;
    // provide a dummy adapter so imports don't throw. Integration tests set a real URL.
    if (process.env.VITEST) {
      const adapter = new PrismaPg({ connectionString: "postgresql://test:test@localhost:5432/test" })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return new PrismaClient({ adapter } as any)
    }
    throw new Error(
      "DATABASE_URL is not set. Add your Supabase connection string to .env (see .env.example)."
    )
  }
  const adapter = new PrismaPg({ connectionString: resolveConnectionString(connectionString) })
  return new PrismaClient({ adapter })
}

export const db = globalForPrisma.prisma ?? createClient()

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = db
}
