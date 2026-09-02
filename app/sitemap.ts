import type { MetadataRoute } from "next"

export default function sitemap(): MetadataRoute.Sitemap {
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? "https://loopcrm.example.com"
  const now = new Date()
  // Static routes — workspace/app routes are behind auth, so only public pages are indexed for SEO
  const routes: MetadataRoute.Sitemap = [
    { url: `${base}/`, lastModified: now, changeFrequency: "daily", priority: 1 },
    { url: `${base}/login`, lastModified: now, changeFrequency: "monthly", priority: 0.6 },
    { url: `${base}/signup`, lastModified: now, changeFrequency: "monthly", priority: 0.7 },
  ]
  // Public sites are dynamic per workspace/project; they are not enumerated here to avoid leaking tenants,
  // but each public site page self-indexes with canonical + sitemap entry via ISR if needed.
  return routes
}
