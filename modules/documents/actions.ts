"use server"
import { db } from "@/lib/db"
import { requireWorkspaceMember } from "@/lib/permissions"
import { documentTemplateSchema } from "@/lib/validators/re"
import { renderShortcodes } from "./shortcodes"
import { requestSignature } from "./esign"
import { auth } from "@/lib/auth"
import { revalidatePath } from "next/cache"

export async function createTemplate({ workspaceId, data }: { workspaceId: string; data: unknown }) {
  const s = await auth(); if (!s?.user?.id) throw new Error("Unauthorized")
  await requireWorkspaceMember(workspaceId, s.user.id)
  const p = documentTemplateSchema.parse(data)
  return db.documentTemplate.create({ data: { ...p, workspaceId } })
}
export async function generateDocument({ workspaceId, templateId, context }: { workspaceId: string; templateId: string; context: Record<string,string> }) {
  const s = await auth(); if (!s?.user?.id) throw new Error("Unauthorized")
  await requireWorkspaceMember(workspaceId, s.user.id)
  const tpl = await db.documentTemplate.findFirst({ where: { id: templateId, workspaceId } })
  if (!tpl) throw new Error("Template not found")
  const rendered = renderShortcodes(tpl.bodyHtml, context)
  return db.generatedDocument.create({ data: { workspaceId, templateId, renderedHtml: rendered } })
}

/** Send a generated document for e-signature (Leegality/Digio; mock in dev). */
export async function requestESign({ workspaceId, generatedDocumentId }: { workspaceId: string; generatedDocumentId: string }) {
  const s = await auth(); if (!s?.user?.id) throw new Error("Unauthorized")
  await requireWorkspaceMember(workspaceId, s.user.id)
  const doc = await db.generatedDocument.findFirst({ where: { id: generatedDocumentId, workspaceId } })
  if (!doc) throw new Error("Document not found")
  const res = await requestSignature({ docId: doc.id, html: doc.renderedHtml })
  await db.generatedDocument.update({ where: { id: doc.id }, data: { eSignStatus: res.status } })
  revalidatePath(`/${workspaceId}/documents`)
  return { requestId: res.id, mock: res.mock, status: res.status }
}
