/**
 * Lead routing — assign an incoming lead to a workspace member.
 * Strategies: ROUND_ROBIN (counter mod N), TERRITORY (locality → territory),
 * SOURCE (kept simple, same as round-robin fallback).
 * Pure function: caller supplies member pool + persisted counter.
 */

export type RoutingStrategy = "ROUND_ROBIN" | "TERRITORY" | "SOURCE"

export type RoutableMember = {
  userId: string
  territories?: string[]
}

export type RoutingOptions = {
  strategy: RoutingStrategy
  counter?: number
  locality?: string
}

export function pickAssignee(members: RoutableMember[], opts: RoutingOptions): string | null {
  if (!members.length) return null

  if (opts.strategy === "TERRITORY" && opts.locality) {
    const loc = opts.locality.trim().toLowerCase()
    const match = members.find((m) => (m.territories ?? []).some((t) => t.trim().toLowerCase() === loc))
    if (match) return match.userId
    // fall through to round-robin
  }

  const idx = ((opts.counter ?? 0) % members.length + members.length) % members.length
  return members[idx].userId
}
