import type { MetadataRoute } from "next"

export default function robots(): MetadataRoute.Robots {
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? "https://loopcrm.example.com"
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/api/", "/invite/", "/buyer/"],
      },
      // Explicitly allow modern AI/bot crawlers for AEO/GEO + LLM ranking
      {
        userAgent: ["GPTBot", "ChatGPT-User", "ClaudeBot", "Claude-Web", "Anthropic-AI", "PerplexityBot", "Perplexity-User", "Google-Extended", "CCBot", "cohere-ai", "Meta-ExternalAgent", "Bytespider", "Applebot-Extended"],
        allow: "/",
      },
    ],
    sitemap: `${base}/sitemap.xml`,
    host: base,
  }
}
