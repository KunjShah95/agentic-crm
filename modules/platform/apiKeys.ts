import { db } from "@/lib/db"
import crypto from "crypto"

export async function createApiKey(workspaceId: string, userId: string, name: string) {
  const key = `sk_${crypto.randomBytes(24).toString("hex")}`
  const hash = crypto.createHash("sha256").update(key).digest("hex")
  // store hash in Workspace.settingsJson.apiKeys
  const ws = await db.workspace.findUnique({ where: { id: workspaceId }, select: { settingsJson: true } })
  const settings = (ws?.settingsJson as Record<string, unknown> | null) ?? {}
  const keys = (settings.apiKeys as Array<{ hash: string; name: string; createdAt: string }> | undefined) ?? []
  keys.push({ hash, name, createdAt: new Date().toISOString() })
  await db.workspace.update({ where: { id: workspaceId }, data: { settingsJson: { ...settings, apiKeys: keys } } })
  await db.activity.create({ data: { workspaceId, type: "NOTE", body: `API key created: ${name}`, createdBy: userId, source: "system" } })
  return { key, hash }
}

export async function verifyApiKey(workspaceId: string, key: string): Promise<boolean> {
  const hash = crypto.createHash("sha256").update(key).digest("hex")
  const ws = await db.workspace.findUnique({ where: { id: workspaceId }, select: { settingsJson: true } })
  const keys = ((ws?.settingsJson as Record<string, unknown> | null)?.apiKeys as Array<{ hash: string }> | undefined) ?? []
  return keys.some((k) => k.hash === hash)
}
