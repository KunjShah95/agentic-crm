import type { MetadataRoute } from "next"
import { BASE_URL, PAGES } from "@/content/marketing"

/**
 * Built from `content/marketing.ts`, so a page cannot be in the sitemap without
 * also having a title and description, and cannot be indexed without someone
 * deciding that in the same file.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date()

  const pages = PAGES.filter((p) => p.index).map((p) => ({
    url: `${BASE_URL}${p.path}`,
    lastModified: now,
    changeFrequency: p.changefreq,
    priority: p.priority,
  }))

  // The LLM-readable entry points. They are not HTML and will never appear in a
  // SERP, but listing them lets a crawler that reads the sitemap discover the
  // markdown versions of the site without being told separately.
  const machine = [
    { url: `${BASE_URL}/llms.txt`, priority: 0.5 },
    { url: `${BASE_URL}/llms-full.txt`, priority: 0.5 },
  ].map((m) => ({
    ...m,
    lastModified: now,
    changeFrequency: "weekly" as const,
  }))

  /*
   * Deliberately absent:
   *   /login     — noindex, and a login page in a sitemap is a free signal that
   *                the site is thin on real content.
   *   tenant /sites/* — enumerating these in one global sitemap would expose
   *                every builder's project inventory to a competitor. Public
   *                project pages are discovered via their own shared links and
   *                carry `noindex` until claimed.
   */
  return [...pages, ...machine]
}
