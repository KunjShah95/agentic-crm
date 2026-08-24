import { PrismaPg } from "@prisma/adapter-pg"
import { PrismaClient } from "@/lib/generated/prisma/client"

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient }

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
  const adapter = new PrismaPg({ connectionString })
  return new PrismaClient({ adapter })
}

export const db = globalForPrisma.prisma ?? createClient()

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = db
}
