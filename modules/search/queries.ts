import { db } from "@/lib/db"

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
 */
export async function searchWorkspace(
  workspaceId: string,
  rawQuery: string
): Promise<SearchHit[]> {
  const q = rawQuery.trim()
  if (!q) return []

  const [contacts, orgs, deals] = await Promise.all([
    db.$queryRaw<RawHit[]>`
      SELECT "id", "firstName" || ' ' || "lastName" AS name, COALESCE("email", '') AS subtitle
      FROM "Contact"
      WHERE "workspaceId" = ${workspaceId}
        AND contact_search_tsv("firstName", "lastName", "email", "jobTitle", "phone")
            @@ prefix_tsquery(${q})
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
