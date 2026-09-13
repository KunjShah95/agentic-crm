"use server"

import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { searchWorkspace, type SearchHit } from "@/modules/search/queries"
import { AppError } from "@/lib/errors"

export type GlobalSearchResult = {
  contacts: Array<{ id: string; name: string; subtitle: string }>
  organizations: Array<{ id: string; name: string; subtitle: string }>
  deals: Array<{ id: string; name: string; subtitle: string }>
  total: number
}

/**
 * Authenticated workspace-scoped search for the ⌘K global search palette.
 * Reuses searchWorkspace (Postgres full-text) and groups hits by type.
 */
export async function globalSearchAction(
  workspaceSlug: string,
  query: string
): Promise<{ data?: GlobalSearchResult; error?: string }> {
  try {
    const q = query.trim()
    if (q.length < 2) {
      return { data: { contacts: [], organizations: [], deals: [], total: 0 } }
    }

    const session = await auth()
    if (!session?.user?.id) throw new AppError("UNAUTHENTICATED", "Log in first.", 401)

    const workspace = await db.workspace.findUnique({
      where: { slug: workspaceSlug },
      select: { id: true },
    })
    if (!workspace) throw new AppError("NOT_FOUND", "Workspace not found.", 404)

    const membership = await db.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId: workspace.id, userId: session.user.id } },
      select: { userId: true },
    })
    if (!membership) throw new AppError("FORBIDDEN", "Not a member of this workspace.", 403)

    const hits: SearchHit[] = await searchWorkspace(workspace.id, q)

    const contacts: GlobalSearchResult["contacts"] = []
    const organizations: GlobalSearchResult["organizations"] = []
    const deals: GlobalSearchResult["deals"] = []
    for (const hit of hits) {
      if (hit.type === "contact") contacts.push({ id: hit.id, name: hit.name, subtitle: hit.subtitle })
      else if (hit.type === "organization") organizations.push({ id: hit.id, name: hit.name, subtitle: hit.subtitle })
      else deals.push({ id: hit.id, name: hit.name, subtitle: hit.subtitle })
    }

    return {
      data: { contacts, organizations, deals, total: hits.length },
    }
  } catch (err) {
    if (err instanceof AppError) return { error: err.message }
    console.error("[global-search]", err)
    return { error: "Search failed. Please try again." }
  }
}
