import { PrismaPg } from "@prisma/adapter-pg"
import { PrismaClient } from "@/lib/generated/prisma/client"

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient }

const SUPABASE_DIRECT_HOST = /^db\.([a-z0-9]+)\.supabase\.co$/i

/**
 * Pooler ports, and why the distinction matters rather than being cosmetic.
 *
 * Supabase exposes two pooler modes on the same hostname:
 *
 *   5432 — session mode. One Postgres session per connection. Everything a session
 *          can do works: session-level `SET`, advisory locks, `LISTEN`, temp tables.
 *   6543 — transaction mode. The server is handed back to the pool at the end of
 *          each transaction, so anything scoped to the *session* is silently lost.
 *
 * The original code hardcoded 6543 here. The rewrite exists to solve IPv6 — the
 * direct host `db.<ref>.supabase.co` is IPv6-only and Vercel has no IPv6 egress —
 * and the pooler is IPv4 in *both* modes. So transaction mode was buying nothing
 * the stated goal required, while quietly removing session semantics.
 *
 * That matters concretely for this codebase: `docs/security/open-findings.md`
 * records the outstanding fix for the missing RLS backstop as setting
 * `app.current_tenant_id` per request, and the RLS policies read exactly that GUC
 * via `current_setting('app.current_tenant_id', true)`. Under transaction mode a
 * plain `SET` would not survive the transaction boundary, so RLS would resolve to
 * NULL and deny every row — the failure would look like a permissions bug rather
 * than a pooling one. Session mode by default, transaction mode opt-in.
 */
const SESSION_POOLER_PORT = "5432"
const TRANSACTION_POOLER_PORT = "6543"

/**
 * Rewrite a direct Supabase connection string to the IPv4 pooler.
 *
 * A no-op unless all of the following hold, and each early return is a case worth
 * naming because getting it wrong is a production-only failure:
 *
 *   - `VERCEL` is set. The rewrite is only needed where there is no IPv6 egress;
 *     applying it locally would needlessly give up the direct connection.
 *   - the host is the direct `db.<ref>.supabase.co` shape. A URL already pointing
 *     at `*.pooler.supabase.com` is left exactly as given, including its port, so
 *     an operator's explicit choice is never overridden.
 *   - the string has a recognisable scheme and authority. Anything else is
 *     returned untouched so the failure surfaces from the driver, naming the URL
 *     the operator configured.
 *
 * The authority is spliced as *text* rather than parsed and re-serialised through
 * `URL`, because a database password is data and `URL` treats several characters
 * as structure. A password containing `/`, `#` or `?` makes `new URL` throw
 * `ERR_INVALID_URL`, and the `try { … } catch { return raw }` this replaced turned
 * that into a silent no-op — and on Vercel, where the direct host is IPv6-only, a
 * rewrite that does not happen means the application cannot reach its database at
 * all, with nothing in the logs mentioning a URL. Splicing cannot corrupt those
 * passwords because the substring is copied through byte for byte and never
 * interpreted.
 *
 * A password containing them unencoded is inherently ambiguous in a connection
 * string — every Postgres client has this problem — so the documented expectation
 * is that `DATABASE_URL` carries it percent-encoded, which is how Supabase issues
 * these strings. What splicing guarantees is that an encoded password survives
 * exactly, and that anything unparseable still yields the original string rather
 * than a mangled one.
 *
 * Exported for testing: this decides whether the application can reach its
 * database on the platform it deploys to, and it runs only when `VERCEL` is set,
 * so nothing in the suite would otherwise execute it.
 *
 * `SUPABASE_POOLER_MODE=transaction` opts into 6543. `SUPABASE_POOLER_HOST`
 * overrides the hostname. `SUPABASE_POOLER_PORT` overrides the port outright, for
 * a pooler on neither standard port.
 */
export function resolveConnectionString(raw: string): string {
  if (!process.env.VERCEL) return raw

  // scheme:// | authority | rest (path, query, fragment)
  //
  // Numbered groups, not named ones: `tsconfig.json` targets ES2017, and named
  // capture groups are an ES2018 feature. The names are therefore carried as
  // index constants so the intent stays readable without raising the compile
  // target for the whole repo to accommodate one regex.
  const parts = /^([a-z][a-z0-9+.-]*:\/\/)([^/?#]*)([\s\S]*)$/i.exec(raw)
  if (!parts) return raw
  const [, scheme, authority, rest] = parts

  // Userinfo may contain a percent-encoded '@'; the host starts after the last
  // literal one.
  const at = authority.lastIndexOf("@")
  if (at === -1) return raw
  const userinfo = authority.slice(0, at)
  const hostPort = authority.slice(at + 1)

  // Port is split off before matching because the pattern is anchored and
  // `host:5432` would not match it.
  const colon = hostPort.lastIndexOf(":")
  const host = colon === -1 ? hostPort : hostPort.slice(0, colon)

  const match = SUPABASE_DIRECT_HOST.exec(host)
  if (!match) return raw

  // Username up to the first colon; everything after it is the password, verbatim.
  const userColon = userinfo.indexOf(":")
  const password = userColon === -1 ? "" : userinfo.slice(userColon + 1)

  const poolerHost = process.env.SUPABASE_POOLER_HOST ?? "aws-0-ap-south-1.pooler.supabase.com"
  const poolerPort =
    process.env.SUPABASE_POOLER_PORT ??
    (process.env.SUPABASE_POOLER_MODE === "transaction"
      ? TRANSACTION_POOLER_PORT
      : SESSION_POOLER_PORT)

  return `${scheme}postgres.${match[1]}:${password}@${poolerHost}:${poolerPort}${rest}`
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
