/**
 * MessagingProvider seam — WhatsApp only.
 *
 * Scope note: X and LinkedIn (Unipile) support were removed on 2026-09-14. The
 * generic shape is kept so a future provider is one file + one registry entry,
 * but nothing outside WhatsApp is wired or advertised to users.
 */

export type NormalizedMessage = {
  kind: "message"
  /** Provider message id (WhatsApp wamid). Always present for real webhooks. */
  externalId: string
  from: {
    /** E.164-ish sender number, digits only for WhatsApp. */
    number?: string
    handle?: string
    name?: string
  }
  body: string
  /** Media kind when the message is not plain text. Raw handle stays in payload. */
  mediaType?: "image" | "audio" | "document" | "video" | "sticker"
  timestamp: string
  threadId?: string
}

export type NormalizedStatus = {
  kind: "status"
  /** The wamid of the outbound message this receipt belongs to. */
  externalId: string
  status: "sent" | "delivered" | "read" | "failed"
  /** Provider error detail when status === "failed". */
  error?: string
  timestamp: string
}

export type NormalizedEvent = NormalizedMessage | NormalizedStatus

export type Tokens = {
  accessToken: string
  refreshToken?: string
  expiresAt?: Date
  /** Stable account identifier for the connection row. */
  externalAccountId: string
  displayName?: string
  /** Routing identity, e.g. { phoneNumberId, wabaId } for WhatsApp. */
  metadata?: Record<string, unknown>
}

export type SendResult = {
  externalId: string
  /** True when no credentials exist and nothing actually left the building. */
  mock: boolean
}

export interface MessagingProvider {
  readonly name: string

  /** True when this provider has what it needs to make real API calls. */
  isConfigured(): boolean

  /** Human-readable missing-config report, for the settings UI. */
  configStatus(): { ok: boolean; missing: string[]; present: string[] }

  getAuthUrl(state: string): string | Promise<string>

  handleCallback(params: {
    code: string
    codeVerifier?: string
    state?: string
  }): Promise<Tokens>

  refresh(refreshToken: string): Promise<Tokens>

  verifyWebhook(request: {
    headers?: Record<string, string>
    query?: Record<string, string | string[] | undefined>
    body?: unknown
    rawBody?: string
  }): boolean | Promise<boolean>

  /**
   * Batch parse — Meta posts arrays, and one webhook body can carry several
   * messages and several delivery receipts. Replaces the old single-event
   * normalize(), which silently dropped everything after the first message.
   */
  parseEvents(payload: unknown): NormalizedEvent[]

  send(ctx: {
    accessToken: string
    metadata: Record<string, unknown>
    to: string
    body: string
  }): Promise<SendResult>

  /** Subscribe the account to the webhook fields we need. */
  subscribeWebhook?(ctx: {
    accessToken: string
    metadata: Record<string, unknown>
  }): Promise<{ ok: boolean; fields: string[]; error?: string }>

  /** Live read-back of the connected number's state, for "Test connection". */
  fetchAccountInfo?(ctx: {
    accessToken: string
    metadata: Record<string, unknown>
  }): Promise<Record<string, unknown>>
}

/** Back-compatible alias — existing imports reference SocialProvider. */
export type SocialProvider = MessagingProvider
