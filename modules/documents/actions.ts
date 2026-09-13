"use server"
import { db } from "@/lib/db"
import { requireWorkspaceMember } from "@/lib/permissions"
import { documentTemplateSchema } from "@/lib/validators/re"
import { renderShortcodes } from "./shortcodes"
import { auth } from "@/lib/auth"

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
