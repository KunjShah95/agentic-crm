/**
 * Signed OAuth state.
 *
 * The previous implementation base64-encoded `{workspaceId, provider, nonce}`
 * and called it CSRF protection, but nothing ever verified the nonce and the
 * payload was unsigned — anyone could mint a valid-looking `state`. Here the
 * payload is HMAC-signed and the nonce must also match a httpOnly cookie set at
 * the moment the user clicked Connect, so a forged callback cannot bind an
 * attacker's account to someone else's workspace.
 */

import crypto from "crypto"
import { cookies } from "next/headers"

const COOKIE_PREFIX = "wa_oauth_state_"
const MAX_AGE_SECONDS = 10 * 60

export type OAuthStatePayload = {
  workspaceId: string
  workspaceSlug: string
  userId: string
  provider: "whatsapp"
  nonce: string
  iat: number
}

function secret(): string {
  const raw = process.env.SOCIAL_TOKEN_KEY ?? process.env.AUTH_SECRET ?? ""
  if (!raw) {
    if (process.env.VITEST) return "vitest-oauth-state-secret"
    throw new Error("Cannot sign OAuth state: set SOCIAL_TOKEN_KEY or AUTH_SECRET.")
  }
  return raw
}

function sign(body: string): string {
  return crypto.createHmac("sha256", secret()).update(body).digest("base64url")
}

export function encodeState(payload: OAuthStatePayload): string {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url")
  return `${body}.${sign(body)}`
}

export function decodeState(state: string | null): OAuthStatePayload | null {
  if (!state) return null
  const [body, mac] = state.split(".")
  if (!body || !mac) return null

  const expected = sign(body)
  const a = Buffer.from(mac)
  const b = Buffer.from(expected)
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null

  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as OAuthStatePayload
    if (payload.provider !== "whatsapp") return null
    if (typeof payload.workspaceId !== "string" || typeof payload.nonce !== "string") return null
    if (Date.now() / 1000 - payload.iat > MAX_AGE_SECONDS) return null
    return payload
  } catch {
    return null
  }
}

export function cookieName(nonce: string): string {
  return `${COOKIE_PREFIX}${nonce}`
}

/** Called when the Connect button is pressed, before redirecting to Meta. */
export async function rememberOAuthState(payload: OAuthStatePayload): Promise<string> {
  const store = await cookies()
  store.set(cookieName(payload.nonce), payload.workspaceId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE_SECONDS,
  })
  return encodeState(payload)
}

/** Consumed on callback so a nonce can only be used once. */
export async function consumeOAuthState(payload: OAuthStatePayload): Promise<boolean> {
  const store = await cookies()
  const name = cookieName(payload.nonce)
  const value = store.get(name)?.value
  store.delete(name)
  return value === payload.workspaceId
}
