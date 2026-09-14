/**
 * Meta WhatsApp Cloud API configuration.
 *
 * Single source of truth for credentials + Graph version so the send path, the
 * webhook path and the settings UI can never disagree about which number or
 * API version is in play. (Previously v19.0 in modules/social and v21.0 in
 * modules/whatsapp/adapter, with two different env var names for the same
 * phone-number id — which meant configuring one silently left the other mocking.)
 */

export const DEFAULT_GRAPH_VERSION = "v23.0"

/** Env vars we read. `WHATSAPP_PHONE_ID` is the legacy name for the same id. */
export type WhatsAppConfig = {
  appId: string
  appSecret: string
  verifyToken: string
  accessToken: string
  phoneNumberId: string
  wabaId: string
  graphVersion: string
  webhookBaseUrl: string
  /** OAuth callback override; defaults to <APP_URL>/api/auth/whatsapp/callback. */
  redirectUri: string
}

function env(...names: string[]): string {
  for (const n of names) {
    const v = process.env[n]
    if (v && v.trim()) return v.trim()
  }
  return ""
}

export function getWhatsAppConfig(): WhatsAppConfig {
  return {
    appId: env("WHATSAPP_APP_ID", "FACEBOOK_APP_ID"),
    appSecret: env("WHATSAPP_APP_SECRET", "FACEBOOK_APP_SECRET", "WA_APP_SECRET"),
    verifyToken: env("WHATSAPP_VERIFY_TOKEN", "WA_VERIFY_TOKEN"),
    accessToken: env("WHATSAPP_TOKEN", "WHATSAPP_ACCESS_TOKEN"),
    phoneNumberId: env("WHATSAPP_PHONE_NUMBER_ID", "WHATSAPP_PHONE_ID"),
    wabaId: env("WHATSAPP_WABA_ID", "WHATSAPP_BUSINESS_ACCOUNT_ID"),
    graphVersion: env("WHATSAPP_GRAPH_VERSION") || DEFAULT_GRAPH_VERSION,
    webhookBaseUrl: env("APP_URL", "NEXT_PUBLIC_APP_URL", "AUTH_URL"),
    redirectUri: env("WHATSAPP_REDIRECT_URI"),
  }
}

/** The four things you cannot receive or send messages without. */
const REQUIRED_SEND: Array<[keyof WhatsAppConfig, string]> = [
  ["accessToken", "WHATSAPP_TOKEN"],
  ["phoneNumberId", "WHATSAPP_PHONE_NUMBER_ID"],
]

const REQUIRED_RECEIVE: Array<[keyof WhatsAppConfig, string]> = [
  ["appSecret", "WHATSAPP_APP_SECRET"],
  ["verifyToken", "WHATSAPP_VERIFY_TOKEN"],
]

export type WhatsAppReadiness = {
  /** Can we deliver real messages to Meta? */
  canSend: boolean
  /** Can we accept + verify inbound webhooks safely? */
  canReceive: boolean
  configured: string[]
  missing: string[]
}

export function whatsappReadiness(cfg: WhatsAppConfig = getWhatsAppConfig()): WhatsAppReadiness {
  const configured: string[] = []
  const missing: string[] = []

  for (const [key, name] of REQUIRED_SEND) {
    if (cfg[key]) configured.push(name)
    else missing.push(name)
  }
  for (const [key, name] of REQUIRED_RECEIVE) {
    if (cfg[key]) configured.push(name)
    else missing.push(name)
  }
  if (cfg.appId) configured.push("WHATSAPP_APP_ID")

  return {
    canSend: REQUIRED_SEND.every(([k]) => Boolean(cfg[k])),
    canReceive: REQUIRED_RECEIVE.every(([k]) => Boolean(cfg[k])),
    configured,
    missing,
  }
}

/**
 * Absolute URL of the single inbound rail, for pasting into the Meta app
 * dashboard (Webhooks → WhatsApp → Callback URL).
 */
export function whatsappWebhookUrl(cfg: WhatsAppConfig = getWhatsAppConfig()): string {
  const base = cfg.webhookBaseUrl.replace(/\/+$/, "") || "http://localhost:3000"
  return `${base}/api/whatsapp/webhook`
}
