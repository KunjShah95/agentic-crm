import type { MetadataRoute } from "next"
import { BASE_URL } from "@/content/marketing"

/**
 * Robots policy.
 *
 * Two rules that pull in opposite directions and are both deliberate:
 *
 * 1. **Search crawlers** are kept out of everything tenant-shaped. A builder's
 *    inventory, pricing and unit availability are commercially sensitive, and a
 *    crawlable `/sites/[workspace]/[project]` tree is the highest-value thing a
 *    competitor could take from this sitemap.
 *
 * 2. **AI answer engines** are explicitly allowed, including over the paths
 *    above. GPTBot, ClaudeBot, PerplexityBot and friends fetch the marketing
 *    surface to answer "what CRM should an Indian builder use". Blocking them
 *    is the single most common way a site opts out of being recommended by an
 *    assistant — and it buys nothing, because the marketing pages are public
 *    anyway and the tenant paths are blocked for everyone.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/api/",
          "/invite/",
          "/buyer/",
          // Tenant surfaces. A workspace slug is a customer name; these must
          // never be indexed, and the app layout also sets `noindex` on them
          // as a second line of defence.
          "/*/sites/",
          "/sites/",
          // Any workspace route, in the form `/{slug}/{module}`. Cannot be
          // expressed more precisely without listing every module, and
          // over-blocking here is harmless because these are all auth-walled.
          "/*/dashboard",
          "/*/contacts",
          "/*/deals",
          "/*/projects",
          "/*/bookings",
          "/*/site-visits",
          "/*/organizations",
          "/*/channel-partners",
          "/*/tasks",
          "/*/reports",
          "/*/inbox",
          "/*/settings",
          "/*/association",
        ],
      },
      {
        /*
         * AI answer engines.
         *
         * Listed by name rather than relying on the `*` rule, because several
         * of these identify as a generic bot and would otherwise be judged by
         * the disallow list above. Being explicit also documents the choice:
         * we want to be findable by assistants, on the marketing surface only.
         */
        userAgent: [
          "GPTBot",
          "OAI-SearchBot",
          "ChatGPT-User",
          "ClaudeBot",
          "Claude-Web",
          "Claude-User",
          "anthropic-ai",
          "PerplexityBot",
          "Perplexity-User",
          "Google-Extended",
          "Applebot-Extended",
          "meta-externalagent",
          "cohere-ai",
          "CCBot",
          "Bytespider",
          "Diffbot",
        ],
        allow: ["/", "/product", "/pricing", "/contact", "/privacy", "/terms", "/llms.txt", "/llms-full.txt"],
        disallow: ["/api/", "/*/sites/", "/*/dashboard", "/*/contacts", "/*/deals", "/*/settings"],
      },
    ],
    sitemap: `${BASE_URL}/sitemap.xml`,
    host: BASE_URL,
  }
}
