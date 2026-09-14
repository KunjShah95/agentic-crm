import type { MessagingProvider } from "./types"
import { WhatsAppProvider } from "./providers/whatsapp"

export type ProviderName = "whatsapp" | "wa"

const providerMap: Record<ProviderName, new () => MessagingProvider> = {
  whatsapp: WhatsAppProvider,
  wa: WhatsAppProvider,
}

/**
 * Resolves a provider by name. Throws on anything else — X and LinkedIn were
 * removed, and an unknown name here means a caller is asking for a channel the
 * product no longer advertises.
 */
export function getProvider(name: string): MessagingProvider {
  const key = name.toLowerCase().trim() as ProviderName
  const Ctor = providerMap[key]
  if (!Ctor) {
    throw new Error(`Unsupported messaging provider: ${name} (only "whatsapp" is available)`)
  }
  return new Ctor()
}

export function isSupportedProvider(name: string): boolean {
  return Object.prototype.hasOwnProperty.call(providerMap, name.toLowerCase().trim())
}

export { WhatsAppProvider }
export type { MessagingProvider, SocialProvider, NormalizedEvent, NormalizedMessage, NormalizedStatus, Tokens, SendResult } from "./types"
