/**
 * SocialProvider seam types.
 * Workspace-scoped normalization for X / WhatsApp / LinkedIn (Unipile).
 */

export type SocialNormalized = {
  externalId: string
  type: string // "message" | "mention" | "comment"
  from: {
    handle: string
    displayName?: string
  }
  body: string
  timestamp: string // ISO 8601
  threadId?: string
}

export interface SocialProvider {
  readonly name: string

  getAuthUrl(state: string): string | Promise<string>

  handleCallback(params: {
    code: string
    codeVerifier?: string
    state?: string
  }): Promise<{
    accessToken: string
    refreshToken?: string
    expiresAt?: Date
    raw?: unknown
  }>

  refresh(refreshToken: string): Promise<{
    accessToken: string
    refreshToken?: string
    expiresAt?: Date
    raw?: unknown
  }>

  verifyWebhook(request: {
    headers?: Record<string, string>
    query?: Record<string, string | string[] | undefined>
    body?: unknown
    rawBody?: string
  }): boolean | Promise<boolean>

  normalize(payload: unknown): SocialNormalized

  /**
   * Optional: send an outbound DM/message via the provider.
   * Only implemented for providers that support outbound messaging.
   */
  sendDm?(params: {
    accessToken: string
    to: string
    body: string
  }): Promise<{ id: string }>

  /**
   * Optional: send a message (generic alias for providers that don't use "DM" terminology).
   */
  sendMessage?(params: {
    accessToken: string
    to: string
    body: string
  }): Promise<{ id: string }>

  /**
   * Optional: register the workspace webhook URL with the provider.
   * Called after OAuth connection to enable inbound event delivery.
   */
  registerWebhook?(params: {
    accessToken: string
    workspaceId: string
    webhookUrl: string
    provider: string
  }): Promise<{ ok: boolean; id?: string }>
}
