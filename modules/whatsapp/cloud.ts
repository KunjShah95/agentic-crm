/**
 * Thin WhatsApp Cloud API client. Everything that talks to Meta goes through
 * here so there is exactly one place that knows URLs, versions and error shape.
 *
 * Deliberately: this NEVER fakes a success. Callers get a real result or a
 * thrown WhatsAppApiError, and mock behaviour is decided one level up in the
 * outbox (where it can be surfaced to the user as "not actually sent").
 */

import { getWhatsAppConfig, type WhatsAppConfig } from "./config"

export class WhatsAppApiError extends Error {
  status: number
  code?: number
  subcode?: number
  details?: string
  /** Meta error messaging that is safe to show an end user. */
  userMessage: string

  constructor(message: string, status: number, payload?: MetaErrorPayload) {
    super(message)
    this.name = "WhatsAppApiError"
    this.status = status
    this.code = payload?.error?.code
    this.subcode = payload?.error?.error_subcode
    this.details = payload?.error?.error_user_msg ?? payload?.error?.message
    this.userMessage = payload?.error?.error_user_msg ?? friendlyFor(status, this.code)
  }
}

type MetaErrorPayload = {
  error?: {
    message?: string
    type?: string
    code?: number
    error_subcode?: number
    error_user_title?: string
    error_user_msg?: string
    fbtrace_id?: string
  }
}

function friendlyFor(status: number, code?: number): string {
  // 190 = invalid/expired token, 102 = user not on WhatsApp, 131026 = recipient cannot receive
  if (code === 190 || code === 102 || status === 401) return "WhatsApp token is invalid or expired — reconnect the account."
  if (code === 131047 || code === 131026) return "This contact cannot receive WhatsApp messages right now."
  if (code === 130472 || code === 131030) return "Outside the 24-hour reply window — the customer must message first."
  if (status === 429) return "WhatsApp rate limit reached. Try again shortly."
  return "WhatsApp request failed. Check the connection settings."
}

async function graph<T>(
  path: string,
  init: RequestInit & { token?: string; cfg?: WhatsAppConfig } = {},
): Promise<T> {
  const cfg = init.cfg ?? getWhatsAppConfig()
  const token = init.token ?? cfg.accessToken
  if (!token) throw new WhatsAppApiError("No WhatsApp access token configured", 0)

  const url = `https://graph.facebook.com/${cfg.graphVersion}/${path}`
  const res = await fetch(url, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(init.headers ?? {}),
    },
  })

  // Tolerate partial Response mocks (the repo's existing tests stub json() only).
  let text = ""
  try {
    text = typeof res.text === "function" ? await res.text() : ""
  } catch {
    text = ""
  }
  let json: unknown = undefined
  try {
    json = text ? JSON.parse(text) : undefined
  } catch {
    /* non-JSON error body */
  }

  if (!res.ok) {
    throw new WhatsAppApiError(
      `Graph ${init.method ?? "GET"} ${path} failed: ${res.status}`,
      res.status,
      json as MetaErrorPayload,
    )
  }
  return json as T
}

export type SendTextResult = { messageId: string }

/** POST /{phoneNumberId}/messages — plain text message. */
export async function cloudSendText(params: {
  to: string
  body: string
  phoneNumberId?: string
  token?: string
  previewUrl?: boolean
}): Promise<SendTextResult> {
  const cfg = getWhatsAppConfig()
  const phoneNumberId = params.phoneNumberId || cfg.phoneNumberId
  if (!phoneNumberId) throw new WhatsAppApiError("WHATSAPP_PHONE_NUMBER_ID is not set", 0)

  const data = await graph<{ messages?: Array<{ id: string }> }>(
    `${phoneNumberId}/messages`,
    {
      method: "POST",
      cfg,
      token: params.token,
      body: JSON.stringify({
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: params.to.replace(/[^\d]/g, ""),
        type: "text",
        text: { preview_url: params.previewUrl ?? false, body: params.body },
      }),
    },
  )
  const messageId = data?.messages?.[0]?.id
  if (!messageId) throw new WhatsAppApiError("Meta accepted the message but returned no wamid", 200)
  return { messageId }
}

/**
 * GET /{phoneNumberId}?fields=... — used by "Test connection" and the settings
 * card. Proves the token can actually see this number.
 */
export async function cloudPhoneNumberInfo(params?: {
  phoneNumberId?: string
  token?: string
}): Promise<{
  phoneNumberId: string
  displayPhoneNumber: string | null
  verifiedName: string | null
  qualityRating: string | null
  platformType: string | null
  webhookVerificationStatus: string | null
}> {
  const cfg = getWhatsAppConfig()
  const phoneNumberId = params?.phoneNumberId || cfg.phoneNumberId
  if (!phoneNumberId) throw new WhatsAppApiError("WHATSAPP_PHONE_NUMBER_ID is not set", 0)
  const data = await graph<Record<string, unknown>>(
    `${phoneNumberId}?fields=display_phone_number,verified_name,quality_rating,platform_type,webhook_verification_status,code_verification_status`,
    { cfg, token: params?.token },
  )
  return {
    phoneNumberId,
    displayPhoneNumber: (data.display_phone_number as string) ?? null,
    verifiedName: (data.verified_name as string) ?? null,
    qualityRating: (data.quality_rating as string) ?? null,
    platformType: (data.platform_type as string) ?? null,
    webhookVerificationStatus: data.webhook_verification_status === 1 ? "verified" : "unverified",
  }
}

/** GET /{wabaId}/account_phones — numbers under the connected business account. */
export async function cloudAccountPhones(params: {
  wabaId?: string
  token?: string
}): Promise<Array<{ id: string; display_phone_number: string; verified_name?: string }>> {
  const cfg = getWhatsAppConfig()
  const wabaId = params.wabaId || cfg.wabaId
  if (!wabaId) throw new WhatsAppApiError("No WABA id to list numbers for", 0)
  const data = await graph<{ data?: Array<{ id: string; display_phone_number: string; verified_name?: string }> }>(
    `${wabaId}/account_phones?fields=id,display_phone_number,verified_name`,
    { cfg, token: params.token },
  )
  return data?.data ?? []
}

/**
 * App-level webhook subscription. Meta delivers inbound messages only for apps
 * subscribed to the `messages` field on whatsapp_business_account.
 * POST /{appId}/subscriptions
 */
export async function cloudSubscribeAppWebhook(params?: {
  appId?: string
  appSecret?: string
  callbackUrl?: string
  verifyToken?: string
  fields?: string[]
}): Promise<{ ok: boolean; fields: string[]; error?: string }> {
  const cfg = getWhatsAppConfig()
  const appId = params?.appId || cfg.appId
  const appSecret = params?.appSecret || cfg.appSecret
  const verifyToken = params?.verifyToken || cfg.verifyToken
  const fields = params?.fields ?? ["messages", "message_template_status_update", "phone_number_quality_update"]
  const { whatsappWebhookUrl } = await import("./config")
  const callbackUrl = params?.callbackUrl || whatsappWebhookUrl(cfg)

  if (!appId || !appSecret || !verifyToken) {
    return { ok: false, fields, error: "Missing WHATSAPP_APP_ID / WHATSAPP_APP_SECRET / WHATSAPP_VERIFY_TOKEN" }
  }

  try {
    await graph(`/${appId}/subscriptions`, {
      method: "POST",
      cfg,
      // App subscriptions authenticate with app_secret, not a bearer token.
      token: appSecret,
      body: JSON.stringify({
        object: "whatsapp_business_account",
        callback_url: callbackUrl,
        verify_token: verifyToken,
        fields,
      }),
    })
    return { ok: true, fields }
  } catch (err) {
    return { ok: false, fields, error: err instanceof Error ? err.message : String(err) }
  }
}

/**
 * GET /{phoneNumberId}/conversations?start&status — conversation *metadata* only.
 * Meta does not expose historical message bodies; this is the full extent of
 * backfill available at link time.
 */
export async function cloudConversationSummary(params?: {
  phoneNumberId?: string
  token?: string
  start?: number
}): Promise<{ total: number; windowStart: number; fetchedAt: string }> {
  const cfg = getWhatsAppConfig()
  const phoneNumberId = params?.phoneNumberId || cfg.phoneNumberId
  const start = params?.start ?? Math.floor(Date.now() / 1000) - 30 * 24 * 3600
  const data = await graph<{ meta?: { count?: number } }>(
    `${phoneNumberId}/conversations?start=${start}&limit=100&status=in_progress,archived`,
    { cfg, token: params?.token },
  )
  return { total: data?.meta?.count ?? 0, windowStart: start, fetchedAt: new Date().toISOString() }
}
