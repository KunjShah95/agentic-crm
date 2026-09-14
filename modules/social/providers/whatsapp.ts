/**
 * WhatsApp Cloud API provider — the only MessagingProvider in the app.
 *
 * Real account linking chain:
 *   code -> short-lived token -> long-lived token -> /me/accounts (WABA + page token)
 *        -> /{wabaId}/account_phones -> the number we send/receive as
 *
 * The WABA-scoped page token (not the user token) is what we persist, because
 * that is the token that can actually send messages for that business account.
 */

import crypto from "crypto"
import type { MessagingProvider, NormalizedEvent, SendResult, Tokens } from "../types"
import { getWhatsAppConfig, whatsappReadiness, type WhatsAppConfig } from "@/modules/whatsapp/config"
import {
  cloudConversationSummary,
  cloudPhoneNumberInfo,
  cloudSendText,
  cloudSubscribeAppWebhook,
} from "@/modules/whatsapp/cloud"

function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a)
  const bufB = Buffer.from(b)
  if (bufA.length !== bufB.length) return false
  return crypto.timingSafeEqual(bufA, bufB)
}

function asText(msg: Record<string, unknown>): Record<string, unknown> | undefined {
  const t = msg["text"]
  if (t && typeof t === "object") return t as Record<string, unknown>
  return undefined
}

export class WhatsAppProvider implements MessagingProvider {
  readonly name = "whatsapp"

  private cfg: WhatsAppConfig

  constructor(cfg?: WhatsAppConfig) {
    this.cfg = cfg ?? getWhatsAppConfig()
  }

  isConfigured(): boolean {
    const r = whatsappReadiness(this.cfg)
    return r.canSend && r.canReceive
  }

  configStatus() {
    const r = whatsappReadiness(this.cfg)
    return { ok: r.canSend && r.canReceive, missing: r.missing, present: r.configured }
  }

  // ── Connect ────────────────────────────────────────────────────────────────

  getAuthUrl(state: string): string {
    const appId = this.cfg.appId
    if (!appId) {
      // Refuse to build a URL that could never work. Previously this silently
      // substituted the literal string "wa_app_id".
      throw new Error("WhatsApp is not configured: set WHATSAPP_APP_ID (or FACEBOOK_APP_ID).")
    }
    const params = new URLSearchParams({
      client_id: appId,
      redirect_uri: this.redirectUri(),
      state,
      response_type: "code",
      scope: "whatsapp_business_messaging,whatsapp_business_management",
    })
    return `https://www.facebook.com/${this.cfg.graphVersion || "v23.0"}/dialog/oauth?${params.toString()}`
  }

  private redirectUri() {
    if (this.cfg.redirectUri) return this.cfg.redirectUri
    const base = this.cfg.webhookBaseUrl.replace(/\/+$/, "") || "http://localhost:3000"
    return `${base}/api/auth/whatsapp/callback`
  }

  async handleCallback(params: { code: string; codeVerifier?: string; state?: string }): Promise<Tokens> {
    const { appId, appSecret } = this.cfg
    if (!appId || !appSecret) throw new Error("WhatsApp OAuth needs WHATSAPP_APP_ID and WHATSAPP_APP_SECRET.")

    // 1. code -> short-lived user token
    const shortUrl = new URL(`https://graph.facebook.com/${this.cfg.graphVersion}/oauth/access_token`)
    shortUrl.searchParams.set("client_id", appId)
    shortUrl.searchParams.set("client_secret", appSecret)
    shortUrl.searchParams.set("redirect_uri", this.redirectUri())
    shortUrl.searchParams.set("code", params.code)
    const shortRes = await fetch(shortUrl)
    const shortData = (await shortRes.json().catch(() => ({}))) as {
      access_token?: string
      expires_in?: number
      error_message?: string
    }
    if (!shortRes.ok || !shortData.access_token) {
      throw new Error(`WhatsApp code exchange failed: ${shortRes.status} ${shortData.error_message ?? ""}`.trim())
    }

    // 2. -> long-lived (60d) user token
    const longUrl = new URL(`https://graph.facebook.com/${this.cfg.graphVersion}/oauth/access_token`)
    longUrl.searchParams.set("grant_type", "fb_exchange_token")
    longUrl.searchParams.set("client_id", appId)
    longUrl.searchParams.set("client_secret", appSecret)
    longUrl.searchParams.set("fb_exchange_token", shortData.access_token)
    const longRes = await fetch(longUrl)
    const longData = (await longRes.json().catch(() => ({}))) as { access_token?: string; expires_in?: number }
    const userToken = longData.access_token ?? shortData.access_token
    const expiresIn = longData.expires_in ?? shortData.expires_in

    // 3. -> WABAs the user controls, each with its own page token
    const acctRes = await fetch(
      `https://graph.facebook.com/${this.cfg.graphVersion}/me/accounts?fields=id,name,access_token,whatsapp_business_account{id,name}&access_token=${encodeURIComponent(userToken)}`,
    )
    if (!acctRes.ok) throw new Error(`WhatsApp account lookup failed: ${acctRes.status}`)
    const accts = (await acctRes.json()) as {
      data?: Array<{ id?: string; name?: string; access_token?: string; whatsapp_business_account?: { id?: string; name?: string } }>
    }
    const businessAccounts = (accts.data ?? []).filter((a) => a.whatsapp_business_account?.id)
    if (!businessAccounts.length) {
      throw new Error("No WhatsApp Business Account found on this Meta account.")
    }

    // With a platform-shared setup there is normally exactly one WABA. If the
    // admin has several, take the first and let them correct it in settings —
    // silently binding the wrong one is worse.
    const chosen = businessAccounts[0]
    const wabaId = chosen.whatsapp_business_account!.id!
    const wabaToken = chosen.access_token || userToken

    // 4. -> the number we will send from
    let phoneNumberId = this.cfg.phoneNumberId
    let displayNumber: string | null = null
    try {
      const phonesRes = await fetch(
        `https://graph.facebook.com/${this.cfg.graphVersion}/${wabaId}/account_phones?fields=id,display_phone_number,verified_name&access_token=${encodeURIComponent(wabaToken)}`,
      )
      if (phonesRes.ok) {
        const phones = (await phonesRes.json()) as {
          data?: Array<{ id: string; display_phone_number?: string; verified_name?: string }>
        }
        const match = phones.data?.find((p) => p.id === this.cfg.phoneNumberId) ?? phones.data?.[0]
        if (match) {
          phoneNumberId = match.id
          displayNumber = match.display_phone_number ?? match.verified_name ?? null
        }
      }
    } catch {
      /* fall back to env phoneNumberId */
    }
    if (!phoneNumberId) throw new Error("Linked a WhatsApp Business Account but found no phone number on it.")

    return {
      accessToken: wabaToken,
      refreshToken: userToken !== wabaToken ? userToken : undefined,
      expiresAt: expiresIn ? new Date(Date.now() + expiresIn * 1000) : undefined,
      externalAccountId: phoneNumberId,
      displayName: displayNumber ?? chosen.name ?? undefined,
      metadata: { phoneNumberId, wabaId },
    }
  }

  async refresh(refreshToken: string): Promise<Tokens> {
    const { appId, appSecret } = this.cfg
    if (!appId || !appSecret) throw new Error("WhatsApp refresh needs WHATSAPP_APP_ID and WHATSAPP_APP_SECRET.")
    const url = new URL(`https://graph.facebook.com/${this.cfg.graphVersion}/oauth/access_token`)
    url.searchParams.set("grant_type", "fb_exchange_token")
    url.searchParams.set("client_id", appId)
    url.searchParams.set("client_secret", appSecret)
    url.searchParams.set("fb_exchange_token", refreshToken)
    const res = await fetch(url)
    if (!res.ok) throw new Error(`WhatsApp token refresh failed: ${res.status}`)
    const data = (await res.json()) as { access_token: string; expires_in?: number }
    return {
      accessToken: data.access_token,
      externalAccountId: "",
      expiresAt: data.expires_in ? new Date(Date.now() + data.expires_in * 1000) : undefined,
    }
  }

  // ── Inbound ────────────────────────────────────────────────────────────────

  verifyWebhook(request: {
    headers?: Record<string, string>
    query?: Record<string, string | string[] | undefined>
    body?: unknown
    rawBody?: string
  }): boolean {
    const lower: Record<string, string> = {}
    for (const [k, v] of Object.entries(request.headers ?? {})) lower[k.toLowerCase()] = v

    const mode = request.query?.["hub.mode"]
    const token = request.query?.["hub.verify_token"]
    const challenge = request.query?.["hub.challenge"]

    // Meta's one-time subscription handshake.
    if (mode !== undefined || token !== undefined || challenge !== undefined) {
      const modeVal = Array.isArray(mode) ? mode[0] : mode
      const tokenVal = Array.isArray(token) ? token[0] : token
      // Fail closed: without a configured verify token there is nothing to
      // verify against, so subscribing is not allowed.
      if (!this.cfg.verifyToken) return false
      return modeVal === "subscribe" && typeof tokenVal === "string" && safeEqual(tokenVal, this.cfg.verifyToken)
    }

    // Every message delivery must carry a signature.
    if (!this.cfg.appSecret) return false
    const signature = lower["x-hub-signature-256"]
    if (!signature || request.rawBody === undefined) return false
    if (!signature.startsWith("sha256=")) return false
    const expected = "sha256=" + crypto.createHmac("sha256", this.cfg.appSecret).update(request.rawBody).digest("hex")
    return safeEqual(signature, expected)
  }

  parseEvents(payload: unknown): NormalizedEvent[] {
    const events: NormalizedEvent[] = []
    const root = payload as Record<string, unknown>
    const entries = Array.isArray(root?.entry) ? root.entry : []

    for (const entry of entries) {
      const changes = Array.isArray((entry as Record<string, unknown>).changes)
        ? ((entry as Record<string, unknown>).changes as Array<Record<string, unknown>>)
        : []

      for (const change of changes) {
        const value = (change.value ?? {}) as Record<string, unknown>
        const metadata = (value.metadata ?? {}) as Record<string, unknown>
        const threadId = metadata.phone_number_id ? String(metadata.phone_number_id) : undefined

        // Contact profile names arrive alongside messages; index by WhatsApp id.
        const nameByNumber = new Map<string, string>()
        for (const c of (Array.isArray(value.contacts) ? value.contacts : []) as Array<Record<string, unknown>>) {
          const profile = c.profile as Record<string, unknown> | undefined
          const waId = c.wa_id ?? profile?.id
          const name = profile?.name
          if (waId && name) nameByNumber.set(String(waId), String(name))
        }

        for (const msg of (Array.isArray(value.messages) ? value.messages : []) as Array<Record<string, unknown>>) {
          const number = msg.from ? String(msg.from) : undefined
          if (!number) continue
          const type = String(msg.type ?? "text")
          const externalId = msg.id ? String(msg.id) : undefined
          if (!externalId) continue // no id -> cannot dedupe -> cannot safely store

          let body = ""
          let mediaType: "image" | "audio" | "document" | "video" | "sticker" | undefined
          const text = asText(msg)
          if (type === "text") {
            body = String(text?.body ?? "")
          } else if (type === "button") {
            body = String((msg.button as Record<string, unknown> | undefined)?.text ?? "")
          } else if (type === "interactive") {
            body = String((msg.interactive as Record<string, unknown> | undefined)?.type ?? "interactive")
          } else if (["image", "audio", "video", "document", "sticker"].includes(type)) {
            const media = (msg[type] ?? {}) as Record<string, unknown>
            body = String(media.caption ?? "") || `[${type}]`
            mediaType = type as "image"
          } else {
            body = `[${type}]`
          }

          const ts = msg.timestamp
          events.push({
            kind: "message",
            externalId,
            from: { number, name: nameByNumber.get(number) },
            body,
            mediaType,
            timestamp: ts ? new Date(Number(ts) * 1000).toISOString() : new Date().toISOString(),
            threadId,
          })
        }

        for (const st of (Array.isArray(value.statuses) ? value.statuses : []) as Array<Record<string, unknown>>) {
          const externalId = st.id ? String(st.id) : undefined
          if (!externalId) continue
          const raw = String(st.status ?? "").toLowerCase()
          const status = (["sent", "delivered", "read", "failed"] as const).includes(raw as "sent")
            ? (raw as "sent" | "delivered" | "read" | "failed")
            : null
          if (!status) continue
          const errors = st.errors as Array<Record<string, unknown>> | undefined
          const ts = st.timestamp
          events.push({
            kind: "status",
            externalId,
            status,
            error: errors?.[0]?.title ? String(errors[0].title) : undefined,
            timestamp: ts ? new Date(Number(ts) * 1000).toISOString() : new Date().toISOString(),
          })
        }
      }
    }
    return events
  }

  // ── Outbound ───────────────────────────────────────────────────────────────

  async send(ctx: { accessToken: string; metadata: Record<string, unknown>; to: string; body: string }): Promise<SendResult> {
    const phoneNumberId = ctx.metadata?.phoneNumberId ? String(ctx.metadata.phoneNumberId) : undefined
    const { messageId } = await cloudSendText({
      to: ctx.to,
      body: ctx.body,
      phoneNumberId,
      token: ctx.accessToken,
    })
    return { externalId: messageId, mock: false }
  }

  async subscribeWebhook(): Promise<{ ok: boolean; fields: string[]; error?: string }> {
    return cloudSubscribeAppWebhook({ appId: this.cfg.appId, appSecret: this.cfg.appSecret, verifyToken: this.cfg.verifyToken })
  }

  async fetchAccountInfo(ctx?: { accessToken?: string; metadata?: Record<string, unknown> }) {
    const phoneNumberId = ctx?.metadata?.phoneNumberId ? String(ctx.metadata.phoneNumberId) : this.cfg.phoneNumberId
    const info = await cloudPhoneNumberInfo({ phoneNumberId, token: ctx?.accessToken })
    let conversations: unknown = null
    try {
      conversations = await cloudConversationSummary({ phoneNumberId, token: ctx?.accessToken })
    } catch {
      /* conversations endpoint is optional */
    }
    return { ...info, conversations }
  }
}
