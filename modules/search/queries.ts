import { db } from "@/lib/db"
import { brokerScopeFilter, type ViewerScope } from "@/lib/permissions"
import { Prisma } from "@/lib/generated/prisma/client"

export type SearchHit = {
  type: "contact" | "organization" | "deal"
  id: string
  name: string
  subtitle: string
  createdAt: Date
}

type RawHit = {
  id: string
  name: string | null
  subtitle: string | null
}

/**
 * Workspace-scoped full-text search across contacts, organizations, and deals.
 *
 * Uses immutable SQL helper functions (contact_search_tsv etc., created by
 * migration 20260913000000_search_expression_indexes) so the WHERE clauses are
 * index-backed by GIN expression indexes. Do NOT reference stored "searchVector"
 * columns — those were dropped in 20260902060046 and a missing column is a hard
 * 42703 error (COALESCE cannot "fall back" past it).
 *
 * `prefix_tsquery` (migration 20261003120000_search_phone_prefix) replaces
 * plainto_tsquery. Two reasons, both found by driving the palette against real
 * data: plainto_tsquery matches whole lexemes only, so "anj" found nothing
 * while "anjali" worked — indistinguishable from a broken feature; and phone
 * was never in the vector at all, so the one lookup a sales team actually
 * needs could not be performed.
 *
 * ── Broker scoping is applied in SQL, not in Prisma ─────────────────────────
 * These three queries are hand-written because the tsvector helpers are
 * immutable SQL functions that Prisma cannot express. That means the broker
 * predicate also has to be hand-written, and it is the only place in the app
 * where a broker filter is expressed as a raw fragment.
 *
 * The contact predicate is therefore spelled out rather than delegated to
 * `brokerContactScope` (which returns a Prisma relation filter this layer
 * cannot consume). It must stay equivalent to it:
 * `deals: { some: { brokerId } }` → `EXISTS (… "cpId" = $brokerId)`.
 *
 * This is also the widest read surface in the product — the command palette is
 * reachable from every page — so an unscoped result set here is a workspace-wide
 * contact and deal dump triggered by three keystrokes.
 */
export async function searchWorkspace(
  scope: ViewerScope,
  rawQuery: string,
): Promise<SearchHit[]> {
  const q = rawQuery.trim()
  if (!q) return []

  const { workspaceId } = scope
  const brokerScope = brokerScopeFilter(scope.role, scope.brokerId)
  // A BROKER with no linked Broker row must match nothing, mirroring the
  // `__no_broker__` sentinel the Prisma-based paths use.
  const brokerId = brokerScope.brokerId ?? "__no_broker__"
  const isBroker = scope.role === "BROKER"

  // `deals: { some: { brokerId } }`, in SQL. Parameterised, never interpolated.
  const contactBrokerSql = isBroker
    ? Prisma.sql`AND EXISTS (
        SELECT 1 FROM "Deal" b
        WHERE b."contactId" = "Contact"."id" AND b."brokerId" = ${brokerId}
      )`
    : Prisma.empty

  const dealBrokerSql = isBroker ? Prisma.sql`AND "brokerId" = ${brokerId}` : Prisma.empty

  const [contacts, orgs, deals] = await Promise.all([
    db.$queryRaw<RawHit[]>`
      SELECT "id", "firstName" || ' ' || "lastName" AS name, COALESCE("email", '') AS subtitle
      FROM "Contact"
      WHERE "workspaceId" = ${workspaceId}
        AND contact_search_tsv("firstName", "lastName", "email", "jobTitle", "phone")
            @@ prefix_tsquery(${q})
        ${contactBrokerSql}
      ORDER BY ts_rank(
          contact_search_tsv("firstName", "lastName", "email", "jobTitle", "phone"),
          prefix_tsquery(${q})
        ) DESC
      LIMIT 8
    `,
    db.$queryRaw<RawHit[]>`
      SELECT "id", "name", COALESCE("domain", '') AS subtitle
      FROM "Organization"
      WHERE "workspaceId" = ${workspaceId}
        AND organization_search_tsv("name", "domain", "industry")
            @@ prefix_tsquery(${q})
      ORDER BY ts_rank(
          organization_search_tsv("name", "domain", "industry"),
          prefix_tsquery(${q})
        ) DESC
      LIMIT 8
    `,
    db.$queryRaw<RawHit[]>`
      SELECT "id", "title" AS name, COALESCE("currency", 'INR') AS subtitle
      FROM "Deal"
      WHERE "workspaceId" = ${workspaceId}
        AND deal_search_tsv("title") @@ prefix_tsquery(${q})
        ${dealBrokerSql}
      ORDER BY ts_rank(deal_search_tsv("title"), prefix_tsquery(${q})) DESC
      LIMIT 8
    `,
  ])

  return [
    ...contacts.map((c) => ({
      type: "contact" as const,
      id: c.id,
      name: c.name ?? "",
      subtitle: c.subtitle ?? "",
      createdAt: new Date(),
    })),
    ...orgs.map((o) => ({
      type: "organization" as const,
      id: o.id,
      name: o.name ?? "",
      subtitle: o.subtitle ?? "",
      createdAt: new Date(),
    })),
    ...deals.map((d) => ({
      type: "deal" as const,
      id: d.id,
      name: d.name ?? "",
      subtitle: d.subtitle ?? "",
      createdAt: new Date(),
    })),
  ]
}
