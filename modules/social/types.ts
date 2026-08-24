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
}
