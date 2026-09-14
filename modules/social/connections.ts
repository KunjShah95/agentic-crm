import crypto from "crypto"
import { db } from "@/lib/db"
import { Prisma } from "@/lib/generated/prisma/client"

/**
 * AES-256-GCM encrypt/decrypt for social tokens.
 * Key derived from SOCIAL_TOKEN_KEY fallback AUTH_SECRET.
 * Format: base64(iv(12) + authTag(16) + ciphertext)
 */

function deriveKey(): Buffer {
  const raw = process.env.SOCIAL_TOKEN_KEY ?? process.env.AUTH_SECRET ?? ""
  if (!raw) {
    // Never derive a key from a known literal: it would "work" in dev and let
    // anyone with the repository decrypt every stored token. Fail loudly.
    if (process.env.NODE_ENV === "production") {
      throw new Error(
        "SOCIAL_TOKEN_KEY (or AUTH_SECRET) must be set in production to encrypt social tokens.",
      )
    }
    if (process.env.VITEST) {
      return crypto.createHash("sha256").update("vitest-only-social-token-key").digest()
    }
    throw new Error(
      "SOCIAL_TOKEN_KEY is not set. Copy a secret into it (see .env.example) before connecting any account.",
    )
  }
  if (!process.env.SOCIAL_TOKEN_KEY && process.env.NODE_ENV === "production") {
    // Reaching here means AUTH_SECRET is doing double duty; rotating it would
    // silently make every stored token undecryptable.
    console.warn(
      "[social] SOCIAL_TOKEN_KEY unset — falling back to AUTH_SECRET. Set a dedicated key or token rotation will destroy stored connections.",
    )
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
  /** { phoneNumberId, wabaId } for WhatsApp — the inbound tenant-resolution key. */
  metadata?: Record<string, unknown>
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
      metadata: (input.metadata ?? undefined) as Prisma.InputJsonValue | undefined,
      status: "active",
    },
    update: {
      displayName: input.displayName,
      accessTokenEnc,
      refreshTokenEnc,
      expiresAt: input.expiresAt,
      ...(input.metadata ? { metadata: input.metadata as Prisma.InputJsonValue } : {}),
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

/**
 * The workspace's live WhatsApp connection, if any. With a platform-shared
 * number there is at most one per workspace; newest wins if history left more.
 */
export async function getActiveConnection(workspaceId: string, provider = "whatsapp") {
  return db.socialConnection.findFirst({
    where: { workspaceId, provider, status: "active" },
    orderBy: { updatedAt: "desc" },
  })
}

/**
 * Inbound tenant resolution: which workspace owns this Meta phone-number id?
 *
 * Returns every candidate because a shared number can legitimately be bound by
 * more than one workspace, and picking one arbitrarily would hand tenant A's
 * customer messages to tenant B. Callers must treat length > 1 as ambiguous.
 */
export async function findConnectionsByPhoneNumberId(phoneNumberId: string, provider = "whatsapp") {
  if (!phoneNumberId) return []
  return db.socialConnection.findMany({
    where: {
      provider,
      status: "active",
      OR: [
        { externalAccountId: phoneNumberId },
        { metadata: { path: ["phoneNumberId"], equals: phoneNumberId } },
      ],
    },
    orderBy: { updatedAt: "desc" },
  })
}

export async function touchLastSync(id: string) {
  return db.socialConnection.update({ where: { id }, data: { lastSyncAt: new Date() } })
}
