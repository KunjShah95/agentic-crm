import crypto from "crypto"
import { db } from "@/lib/db"

/**
 * AES-256-GCM encrypt/decrypt for social tokens.
 * Key derived from SOCIAL_TOKEN_KEY fallback AUTH_SECRET.
 * Format: base64(iv(12) + authTag(16) + ciphertext)
 */

function deriveKey(): Buffer {
  const raw = process.env.SOCIAL_TOKEN_KEY ?? process.env.AUTH_SECRET ?? ""
  // For tests, env may be "test-secret" -> hash to 32 bytes
  // If already 32+ chars, still hash to get deterministic 32-byte key
  if (!raw) {
    // fallback for dev/test when nothing set - deterministic but insecure
    return crypto.createHash("sha256").update("dev-fallback-social-token-key-please-set-env").digest()
  }
  return crypto.createHash("sha256").update(raw).digest()
}

export function encrypt(plaintext: string): string {
  const key = deriveKey()
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv)
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()])
  const authTag = cipher.getAuthTag()
  const combined = Buffer.concat([iv, authTag, encrypted])
  return combined.toString("base64")
}

export function decrypt(enc: string): string {
  const key = deriveKey()
  const buf = Buffer.from(enc, "base64")
  if (buf.length < 28) {
    throw new Error("Invalid encrypted token: too short")
  }
  const iv = buf.subarray(0, 12)
  const authTag = buf.subarray(12, 28)
  const ciphertext = buf.subarray(28)
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv)
  decipher.setAuthTag(authTag)
  const plain = Buffer.concat([decipher.update(ciphertext), decipher.final()])
  return plain.toString("utf8")
}

// ---- CRUD helpers ----

export type CreateConnectionInput = {
  workspaceId: string
  provider: string
  externalAccountId: string
  displayName?: string
  accessToken: string
  refreshToken?: string
  expiresAt?: Date
}

export async function createConnection(input: CreateConnectionInput) {
  const accessTokenEnc = encrypt(input.accessToken)
  const refreshTokenEnc = input.refreshToken ? encrypt(input.refreshToken) : null
  return db.socialConnection.upsert({
    where: {
      workspaceId_provider_externalAccountId: {
        workspaceId: input.workspaceId,
        provider: input.provider,
        externalAccountId: input.externalAccountId,
      },
    },
    create: {
      workspaceId: input.workspaceId,
      provider: input.provider,
      externalAccountId: input.externalAccountId,
      displayName: input.displayName,
      accessTokenEnc,
      refreshTokenEnc,
      expiresAt: input.expiresAt,
      status: "active",
    },
    update: {
      displayName: input.displayName,
      accessTokenEnc,
      refreshTokenEnc,
      expiresAt: input.expiresAt,
      status: "active",
      lastSyncAt: new Date(),
    },
  })
}

export async function getConnections(workspaceId: string) {
  return db.socialConnection.findMany({
    where: { workspaceId },
    orderBy: { createdAt: "desc" },
  })
}

export async function getConnection(id: string) {
  return db.socialConnection.findUnique({ where: { id } })
}

export async function getConnectionByProvider(
  workspaceId: string,
  provider: string,
  externalAccountId: string
) {
  return db.socialConnection.findUnique({
    where: {
      workspaceId_provider_externalAccountId: {
        workspaceId,
        provider,
        externalAccountId,
      },
    },
  })
}

export async function updateTokens(
  id: string,
  tokens: { accessToken: string; refreshToken?: string; expiresAt?: Date }
) {
  const data: Record<string, unknown> = {
    accessTokenEnc: encrypt(tokens.accessToken),
    status: "active",
    lastSyncAt: new Date(),
  }
  if (tokens.refreshToken !== undefined) {
    data.refreshTokenEnc = encrypt(tokens.refreshToken)
  }
  if (tokens.expiresAt !== undefined) {
    data.expiresAt = tokens.expiresAt
  }
  return db.socialConnection.update({
    where: { id },
    data,
  })
}

export async function markNeedsReauth(id: string) {
  return db.socialConnection.update({
    where: { id },
    data: { status: "needs_reauth" },
  })
}

export async function deleteConnection(id: string) {
  return db.socialConnection.delete({ where: { id } })
}

export function decryptAccessToken(enc: string): string {
  return decrypt(enc)
}

export function decryptRefreshToken(enc: string | null | undefined): string | null {
  if (!enc) return null
  return decrypt(enc)
}
