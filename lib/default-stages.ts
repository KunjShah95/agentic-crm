import type { StageKind } from "@/lib/pipeline-stages"

/**
 * The pipelines a new workspace starts with.
 *
 * These lived as three independent literal arrays — `lib/actions/workspaces.ts`,
 * `lib/actions/auth.ts`, and `prisma/seed.ts` — and they had already drifted:
 * the signup flow created a generic-SaaS pipeline ("Lead → Qualified → Proposal
 * → Negotiation") while a workspace created from the sidebar got the
 * real-estate one. More importantly they carried no `kind`, so a brand-new
 * workspace got a stage named "Won" that the revenue maths did not recognise as
 * won, and its first won deal would have been invisible.
 *
 * `kind` is set explicitly here rather than left to the database default. The
 * default is `OPEN`, which is right for a stage somebody invents, but these six
 * are a known pipeline and two of them are closed stages — relying on a default
 * here would be relying on nothing at all.
 */

export type DefaultStage = { name: string; color: string; kind: StageKind }

/** Used by the seed and by workspaces created from the sidebar. */
export const DEFAULT_STAGES_REAL_ESTATE: DefaultStage[] = [
  { name: "Enquiry", color: "#64748b", kind: "OPEN" },
  { name: "Site Visit", color: "#3b82f6", kind: "OPEN" },
  { name: "Hold", color: "#8b5cf6", kind: "OPEN" },
  { name: "Booking", color: "#f59e0b", kind: "OPEN" },
  { name: "Won", color: "#10b981", kind: "WON" },
  { name: "Lost", color: "#ef4444", kind: "LOST" },
]

/**
 * The pipeline a new signup starts with.
 *
 * Same shape, generic names. Kept distinct rather than collapsed into the
 * real-estate list because a signup has not yet been through onboarding, and
 * showing "Site Visit" to someone who has never heard of a site visit is worse
 * than showing them the generic funnel. Both end in the same two closed
 * stages, which is the part that actually matters to the maths.
 */
export const DEFAULT_STAGES_GENERIC: DefaultStage[] = [
  { name: "Lead", color: "#64748b", kind: "OPEN" },
  { name: "Qualified", color: "#3b82f6", kind: "OPEN" },
  { name: "Proposal", color: "#8b5cf6", kind: "OPEN" },
  { name: "Negotiation", color: "#f59e0b", kind: "OPEN" },
  { name: "Won", color: "#10b981", kind: "WON" },
  { name: "Lost", color: "#ef4444", kind: "LOST" },
]