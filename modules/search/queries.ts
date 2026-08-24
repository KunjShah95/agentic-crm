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

export async function searchWorkspace(
  workspaceId: string,
  rawQuery: string
): Promise<SearchHit[]> {
  const q = rawQuery.trim()
  if (!q) return []

  // Uses stored tsvector GIN columns when migration 20260809000001 is applied;
  // falls back to inline to_tsvector when column is absent (pre-migration).
  const [contacts, orgs, deals] = await Promise.all([
    db.$queryRaw<RawHit[]>`
      SELECT "id", "firstName" || ' ' || "lastName" AS name, COALESCE("email", '') AS subtitle
      FROM "Contact"
      WHERE "workspaceId" = ${workspaceId}
        AND COALESCE("searchVector",
            to_tsvector('english', COALESCE("firstName",'') || ' ' || COALESCE("lastName",'') || ' ' || COALESCE("email",'') || ' ' || COALESCE("jobTitle",''))
          ) @@ plainto_tsquery('english', ${q})
      ORDER BY ts_rank(COALESCE("searchVector",
            to_tsvector('english', COALESCE("firstName",'') || ' ' || COALESCE("lastName",'') || ' ' || COALESCE("email",'') || ' ' || COALESCE("jobTitle",''))
          ), plainto_tsquery('english', ${q})) DESC
      LIMIT 8
    `,
    db.$queryRaw<RawHit[]>`
      SELECT "id", "name", COALESCE("domain", '') AS subtitle
      FROM "Organization"
      WHERE "workspaceId" = ${workspaceId}
        AND COALESCE("searchVector",
            to_tsvector('english', COALESCE("name",'') || ' ' || COALESCE("domain",'') || ' ' || COALESCE("industry",''))
          ) @@ plainto_tsquery('english', ${q})
      ORDER BY ts_rank(COALESCE("searchVector",
            to_tsvector('english', COALESCE("name",'') || ' ' || COALESCE("domain",'') || ' ' || COALESCE("industry",''))
          ), plainto_tsquery('english', ${q})) DESC
      LIMIT 8
    `,
    db.$queryRaw<RawHit[]>`
      SELECT "id", "title" AS name, COALESCE("currency", 'USD') AS subtitle
      FROM "Deal"
      WHERE "workspaceId" = ${workspaceId}
        AND COALESCE("searchVector",
            to_tsvector('english', COALESCE("title",''))
          ) @@ plainto_tsquery('english', ${q})
      ORDER BY ts_rank(COALESCE("searchVector",
            to_tsvector('english', COALESCE("title",''))
          ), plainto_tsquery('english', ${q})) DESC
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
