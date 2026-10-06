/**
 * DB-driven lead source configuration.
 *
 * Allows ops to onboard partners without a deploy — each source can have its
 * own field map, secret hash, enabled/trusted flags, and auto-ack override,
 * all stored in the `LeadSourceConfig` table.
 */

import { db } from "@/lib/db"
import { Prisma } from "@/lib/generated/prisma/client"

export type LeadSourceConfigData = {
  source: string
  fieldMap?: Record<string, string> | null
  secretHash?: string | null
  enabled?: boolean
  trusted?: boolean
  autoAck?: boolean
}

export type LeadSourceConfigUpdate = Omit<LeadSourceConfigData, "source">

export async function getSourceConfig(
  workspaceId: string,
  source: string
): Promise<LeadSourceConfigData | null> {
  const row = await db.leadSourceConfig.findUnique({
    where: { workspaceId_source: { workspaceId, source } },
  })
  if (!row) return null
  return {
    source: row.source,
    fieldMap: row.fieldMap as Record<string, string> | null,
    secretHash: row.secretHash,
    enabled: row.enabled,
    trusted: row.trusted,
    autoAck: row.autoAck,
  }
}

export async function listSourceConfigs(
  workspaceId: string
): Promise<LeadSourceConfigData[]> {
  const rows = await db.leadSourceConfig.findMany({
    where: { workspaceId },
    orderBy: { source: "asc" },
  })
  return rows.map((row) => ({
    source: row.source,
    fieldMap: row.fieldMap as Record<string, string> | null,
    secretHash: row.secretHash,
    enabled: row.enabled,
    trusted: row.trusted,
    autoAck: row.autoAck,
  }))
}

export async function createSourceConfig(
  workspaceId: string,
  data: LeadSourceConfigData
): Promise<LeadSourceConfigData> {
  const row = await db.leadSourceConfig.create({
    data: {
      workspaceId,
      source: data.source,
      fieldMap: data.fieldMap ?? undefined,
      secretHash: data.secretHash ?? null,
      enabled: data.enabled ?? true,
      trusted: data.trusted ?? false,
      autoAck: data.autoAck ?? false,
    },
  })
  return {
    source: row.source,
    fieldMap: row.fieldMap as Record<string, string> | null,
    secretHash: row.secretHash,
    enabled: row.enabled,
    trusted: row.trusted,
    autoAck: row.autoAck,
  }
}

export async function updateSourceConfig(
  workspaceId: string,
  source: string,
  data: LeadSourceConfigUpdate
): Promise<LeadSourceConfigData> {
  const row = await db.leadSourceConfig.update({
    where: { workspaceId_source: { workspaceId, source } },
    data: {
      ...(data.fieldMap !== undefined && {
        fieldMap: data.fieldMap === null ? Prisma.JsonNull : data.fieldMap,
      }),
      ...(data.secretHash !== undefined && { secretHash: data.secretHash }),
      ...(data.enabled !== undefined && { enabled: data.enabled }),
      ...(data.trusted !== undefined && { trusted: data.trusted }),
      ...(data.autoAck !== undefined && { autoAck: data.autoAck }),
    },
  })
  return {
    source: row.source,
    fieldMap: row.fieldMap as Record<string, string> | null,
    secretHash: row.secretHash,
    enabled: row.enabled,
    trusted: row.trusted,
    autoAck: row.autoAck,
  }
}

export async function deleteSourceConfig(
  workspaceId: string,
  source: string
): Promise<void> {
  await db.leadSourceConfig.delete({
    where: { workspaceId_source: { workspaceId, source } },
  })
}

/**
 * Returns true if the source is enabled. Defaults to true when no config
 * row exists (opt-out model — new sources work without a config).
 */
export async function isSourceEnabled(
  workspaceId: string,
  source: string
): Promise<boolean> {
  const config = await getSourceConfig(workspaceId, source)
  return config?.enabled ?? true
}

/**
 * Returns true if the source is trusted for auto-ack. Defaults to false
 * when no config row exists.
 */
export async function isSourceTrusted(
  workspaceId: string,
  source: string
): Promise<boolean> {
  const config = await getSourceConfig(workspaceId, source)
  return config?.trusted ?? false
}

/**
 * Returns the per-source auto-ack setting. Defaults to the workspace-level
 * setting when no per-source override exists.
 */
export async function isAutoAckEnabled(
  workspaceId: string,
  source: string
): Promise<boolean> {
  const config = await getSourceConfig(workspaceId, source)
  if (config) return config.autoAck ?? false
  // Fall back to workspace-level setting
  const { isAutoAckEnabled: wsAutoAck } = await import("./ingress")
  return wsAutoAck(workspaceId)
}

/**
 * Returns the field map for a source, or null if none is configured.
 */
export async function getFieldMap(
  workspaceId: string,
  source: string
): Promise<Record<string, string> | null> {
  const config = await getSourceConfig(workspaceId, source)
  return config?.fieldMap ?? null
}
