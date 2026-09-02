import { db } from "@/lib/db"

export async function listTemplates(workspaceId: string) {
  return db.documentTemplate.findMany({
    where: { workspaceId },
    orderBy: { createdAt: "desc" },
    select: { id: true, kind: true, name: true, reraAligned: true, createdAt: true },
  })
}

export async function listGeneratedDocuments(workspaceId: string) {
  return db.generatedDocument.findMany({
    where: { workspaceId },
    orderBy: { createdAt: "desc" },
    take: 100,
    select: {
      id: true,
      renderedHtml: true,
      pdfUrl: true,
      eSignStatus: true,
      createdAt: true,
      dealId: true,
      unitId: true,
      template: { select: { kind: true, name: true } },
    },
  })
}
