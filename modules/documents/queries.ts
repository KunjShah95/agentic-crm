import { db } from "@/lib/db"
import type { ViewerScope } from "@/lib/permissions"

/**
 * `DocumentTemplate` is workspace configuration — the RERA-aligned template set
 * the whole office picks from. There is no per-broker variant, so this is
 * workspace-wide by design.
 */
export async function listTemplates(workspaceId: string) {
  return db.documentTemplate.findMany({
    where: { workspaceId },
    orderBy: { createdAt: "desc" },
    select: { id: true, kind: true, name: true, reraAligned: true, createdAt: true },
  })
}

/**
 * Generated documents — allotment letters, receipts, booking forms — are deal
 * artefacts and would ideally be broker-scoped, since `renderedHtml` is the full
 * document body including the buyer's name, unit and payment figures.
 *
 * **They are not, and the reason is structural rather than an oversight.**
 * `GeneratedDocument.dealId` is a bare column with no `@relation` to `Deal` (and
 * `Deal` has no back-relation either), so there is nothing to filter through.
 * Prisma cannot express "deal belongs to this broker" without either a relation
 * to traverse or an unbounded `dealId IN (…)` list built from a second query.
 *
 * Two ways to close it, both needing a migration and a product decision, so
 * neither is taken unilaterally here:
 *
 *  1. Add `deal Deal? @relation(fields: [dealId], references: [id])` to
 *     `GeneratedDocument` and the matching list on `Deal`, then filter the
 *     relation exactly as `siteVisits::listSiteVisits` does. Smallest diff.
 *  2. Denormalise `brokerId` onto `GeneratedDocument` at generation time.
 *     Faster to filter, but it has to be kept in sync when a deal is
 *     reassigned to a different broker.
 *
 * Tracked in `docs/security/open-findings.md`. Until then this is recorded in the
 * broker-visibility registry as workspace-wide with this reason, so the gap is
 * visible rather than assumed safe.
 */
export async function listGeneratedDocuments(scope: ViewerScope) {
  return db.generatedDocument.findMany({
    where: { workspaceId: scope.workspaceId },
    orderBy: { createdAt: "desc" },
    take: 100,
    select: {
      id: true,
      renderedHtml: true,
      pdfUrl: true,
      createdAt: true,
      dealId: true,
      unitId: true,
      template: { select: { kind: true, name: true } },
    },
  })
}
