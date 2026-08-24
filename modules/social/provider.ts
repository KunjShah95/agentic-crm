import type { SocialProvider } from "./types"
import { XDirectProvider } from "./providers/x"
import { WADirectProvider } from "./providers/whatsapp"
import { LIUnipileProvider } from "./providers/linkedin-unipile"

export type ProviderName = "x" | "twitter" | "whatsapp" | "wa" | "linkedin" | "li" | "unipile" | "linkedin-unipile"

const providerMap: Record<string, new () => SocialProvider> = {
  x: XDirectProvider,
  twitter: XDirectProvider,
  whatsapp: WADirectProvider,
  wa: WADirectProvider,
  linkedin: LIUnipileProvider,
  li: LIUnipileProvider,
  unipile: LIUnipileProvider,
  "linkedin-unipile": LIUnipileProvider,
}

export function getProvider(name: string): SocialProvider {
  const key = name.toLowerCase().trim()
  const Ctor = providerMap[key]
  if (!Ctor) {
    throw new Error(`Unknown social provider: ${name}`)
  }
  return new Ctor()
}

// Re-exports for convenience / testing
export { XDirectProvider } from "./providers/x"
export { WADirectProvider } from "./providers/whatsapp"
export { LIUnipileProvider } from "./providers/linkedin-unipile"
export type { SocialProvider, SocialNormalized } from "./types"
