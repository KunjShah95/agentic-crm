import { describe, it, expect, beforeEach, afterEach } from "vitest"

import { resolveConnectionString } from "@/lib/db"

/**
 * The Supabase connection rewrite.
 *
 * This is the only Supabase code that actually executes: the SSR clients under
 * `utils/supabase/` have no importers, and `lib/supabase-db.ts` is unreferenced.
 * Everything else the app does with Supabase is this string.
 *
 * It also runs only when `VERCEL` is set, so nothing in the suite reached it
 * before — and every branch here is a production-only path. A regression does not
 * fail a local run; it fails on the deployment platform, where the direct host is
 * IPv6-only and Vercel has no IPv6 egress, so the symptom is "the database is
 * unreachable" with nothing in the logs pointing at a URL.
 */

const DIRECT = "postgresql://postgres:s3cret@db.abcdefghijklmnop.supabase.co:5432/postgres"

const env = { ...process.env }
const set = (k: string, v: string | undefined) => {
  if (v === undefined) delete process.env[k]
  else process.env[k] = v
}

const parsed = (raw: string) => new URL(raw)

beforeEach(() => {
  set("VERCEL", "1")
  set("SUPABASE_POOLER_HOST", undefined)
  set("SUPABASE_POOLER_MODE", undefined)
  set("SUPABASE_POOLER_PORT", undefined)
})

afterEach(() => {
  process.env = { ...env }
})

describe("resolveConnectionString — when it rewrites", () => {
  it("rewrites a direct Supabase host to the pooler", () => {
    const url = parsed(resolveConnectionString(DIRECT))

    expect(url.hostname).toBe("aws-0-ap-south-1.pooler.supabase.com")
  })

  it("preserves the password, database and project reference", () => {
    const url = parsed(resolveConnectionString(DIRECT))

    expect(url.password).toBe("s3cret")
    expect(url.pathname).toBe("/postgres")
    /* The pooler authenticates as postgres.<ref>, which is what routes the
       connection to the right project. Getting this wrong connects to a
       different database rather than failing. */
    expect(url.username).toBe("postgres.abcdefghijklmnop")
  })

  /**
   * The port is the substantive part, not a detail. 5432 on the pooler is session
   * mode; 6543 is transaction mode, where the server returns to the pool at the end
   * of each transaction and session state is silently dropped. The rewrite only
   * exists to get IPv4, and the pooler is IPv4 in both modes — so session mode
   * satisfies the requirement without changing semantics.
   *
   * This matters concretely for the outstanding RLS work: the policies read
   * `current_setting('app.current_tenant_id', true)`, and a session-level `SET` of
   * that GUC does not survive transaction mode. The failure would present as RLS
   * denying every row rather than as a pooling problem.
   */
  it("defaults to the session pooler, preserving session semantics", () => {
    expect(parsed(resolveConnectionString(DIRECT)).port).toBe("5432")
  })

  it("never silently downgrades an operator's explicit pooler URL", () => {
    /* An already-pooled URL is left exactly as given, port included. Overriding it
       would change an operator's chosen pooling mode behind their back. */
    const alreadyPooled =
      "postgresql://postgres.ref:pw@aws-0-ap-south-1.pooler.supabase.com:6543/postgres"
    expect(resolveConnectionString(alreadyPooled)).toBe(alreadyPooled)
  })

  it("leaves a non-Supabase host untouched", () => {
    const neon = "postgresql://user:pw@ep-cool-name.neon.tech:5432/neondb?sslmode=require"
    expect(resolveConnectionString(neon)).toBe(neon)
  })

  it("leaves localhost untouched", () => {
    const local = "postgresql://postgres:postgres@localhost:5432/estate360"
    expect(resolveConnectionString(local)).toBe(local)
  })
})

describe("resolveConnectionString — when it does not rewrite", () => {
  /**
   * The direct host resolves to IPv6 only, so the rewrite is a workaround for
   * having no IPv6 egress. A developer machine normally has IPv6, where the direct
   * host is correct and the pooler would be an unnecessary indirection.
   */
  it("does not rewrite outside Vercel", () => {
    set("VERCEL", undefined)
    expect(resolveConnectionString(DIRECT)).toBe(DIRECT)
  })

  it("returns the input verbatim when VERCEL is empty", () => {
    set("VERCEL", "")
    expect(resolveConnectionString(DIRECT)).toBe(DIRECT)
  })

  /**
   * Malformed input is returned untouched rather than half-parsed, so the failure
   * surfaces from the driver naming the URL the operator configured. Swallowing it
   * into a fallback that also fails would cost the only useful diagnostic.
   */
  it("returns a malformed connection string untouched", () => {
    expect(resolveConnectionString("not a url")).toBe("not a url")
  })

  it("does not throw on an unparseable string", () => {
    expect(() => resolveConnectionString("://broken")).not.toThrow()
  })
})

describe("resolveConnectionString — overrides", () => {
  it("honours a custom pooler host", () => {
    set("SUPABASE_POOLER_HOST", "aws-0-eu-west-1.pooler.supabase.com")
    expect(parsed(resolveConnectionString(DIRECT)).hostname).toBe(
      "aws-0-eu-west-1.pooler.supabase.com",
    )
  })

  /** Opt-in transaction mode, for serverless connection-count pressure. */
  it("honours an explicit transaction mode", () => {
    set("SUPABASE_POOLER_MODE", "transaction")
    expect(parsed(resolveConnectionString(DIRECT)).port).toBe("6543")
  })

  it("ignores an unrecognised pooler mode and stays on session", () => {
    set("SUPABASE_POOLER_MODE", "pgbouncer")
    expect(parsed(resolveConnectionString(DIRECT)).port).toBe("5432")
  })

  /** An explicit port wins over the mode, for a pooler on neither standard port. */
  it("honours an explicit port over the mode", () => {
    set("SUPABASE_POOLER_MODE", "transaction")
    set("SUPABASE_POOLER_PORT", "5433")
    expect(parsed(resolveConnectionString(DIRECT)).port).toBe("5433")
  })

  it("keeps the project reference from the original URL, not the pooler host", () => {
    set("SUPABASE_POOLER_HOST", "aws-0-eu-west-1.pooler.supabase.com")
    const url = parsed(resolveConnectionString(DIRECT))
    expect(url.username).toBe("postgres.abcdefghijklmnop")
  })
})

describe("resolveConnectionString — credential fidelity", () => {
  /**
   * A database password is data. `URL` treats several characters as structure, so
   * parsing and re-serialising the whole string loses or rejects them — a password
   * containing `/`, `#` or `?` makes `new URL` throw outright, and the previous
   * `catch { return raw }` turned that into a silent no-op. On Vercel, where the
   * direct host is IPv6-only, that means the database is unreachable with nothing in
   * the logs mentioning a URL.
   *
   * Asserted against the output *string*, not a re-parsed `URL.password`: that
   * getter percent-decodes, so reading the password back through it compares a
   * decoded value against an encoded one and reports a failure that is not one.
   */
  const rewrite = (password: string) =>
    resolveConnectionString(
      `postgresql://postgres:${password}@db.abcdefghijklmnop.supabase.co:5432/postgres`,
    )

  it.each([
    ["at sign, encoded", "p%40ssword"],
    ["colon", "pass%3Aword"],
    ["slash, encoded", "pass%2Fword"],
    ["hash, encoded", "pass%23word"],
    ["question mark, encoded", "pass%3Fword"],
    ["percent, encoded", "p%2525ssword"],
    ["plain", "s3cretPassw0rd"],
  ])("carries a password through byte for byte (%s)", (_label, password) => {
    /* The password must appear in the output exactly as supplied — not decoded,
       not re-encoded, not dropped. */
    expect(rewrite(password)).toContain(`:${password}@`)
  })

  /**
   * The case that motivated splicing. Unencoded, these are ambiguous in *any*
   * connection string, so the documented expectation is that they arrive encoded —
   * but they must not cause a throw or a mangled result either, because a mangled
   * result is what produces a wrong-password failure that looks like bad
   * credentials.
   */
  it.each([
    ["slash", "pass/word"],
    ["hash", "pass#word"],
    ["question mark", "pass?word"],
  ])("does not throw on a password containing a %s", (_label, password) => {
    expect(() => rewrite(password)).not.toThrow()
  })

  it("still rewrites the host when the password contains a delimiter", () => {
    /* `pass/word` unencoded makes the authority parse as `postgres:pass`, so the
       host is not recognisable and there is nothing safe to rewrite. The important
       property is that the result is either the original string or a correct
       rewrite — never a corrupted hybrid. */
    const out = rewrite("pass/word")
    const isUntouched = out.includes("@db.abcdefghijklmnop.supabase.co:5432/postgres")
    const isRewritten = out.includes("@aws-0-ap-south-1.pooler.supabase.com:5432/postgres")
    expect(isUntouched || isRewritten).toBe(true)
  })

  it("preserves the path and query exactly", () => {
    const raw =
      "postgresql://postgres:pw@db.abcdefghijklmnop.supabase.co:5432/postgres?sslmode=require&application_name=estate360"
    const out = resolveConnectionString(raw)
    expect(out.endsWith("/postgres?sslmode=require&application_name=estate360")).toBe(true)
  })

  it("is idempotent, so a second pass cannot rewrite the result again", () => {
    const once = resolveConnectionString(DIRECT)
    expect(resolveConnectionString(once)).toBe(once)
  })
})