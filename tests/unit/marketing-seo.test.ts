import { describe, it, expect, vi } from "vitest"
import fs from "node:fs"
import path from "node:path"
import { REPO_ROOT } from "../helpers/source-scan"
import {
  BASE_URL,
  BRAND,
  FAQ,
  PAGE_BY_PATH,
  PAGES,
  resolveBaseUrl,
} from "@/content/marketing"
import { llmsFullTxt, llmsTxt } from "@/content/llms-txt"
import {
  breadcrumbLd,
  faqLd,
  organizationLd,
  softwareLd,
} from "@/components/seo/structured-data"

/**
 * SEO / AEO / GEO conformance.
 *
 * These rules are about the gap between what a page says and what the machine
 * -reading copy claims it says. That gap is silent: nothing breaks, no test
 * fails, the page ranks, and six months later the structured data is describing
 * a product that no longer exists.
 *
 * The three audiences, and the failure unique to each:
 *
 *  - **SEO**   a stale title or a canonical pointing somewhere else
 *  - **AEO**   a FAQ node whose answers no longer match the rendered page
 *  - **GEO**   a summary a model can quote that omits the actual answer
 */

function read(rel: string) {
  return fs.readFileSync(path.join(REPO_ROOT, rel), "utf8")
}

/** CRLF → LF, so text comparisons do not depend on the checkout platform. */
function normalizeEol(s: string) {
  return s.replace(/\r\n/g, "\n")
}

/**
 * Replace the origin of every absolute URL with a placeholder.
 *
 * `public/llms.txt` is a committed artifact containing absolute URLs, so it can
 * only ever be correct for one domain — and which domain that is depends on
 * NEXT_PUBLIC_SITE_URL at generation time. Comparing it verbatim therefore
 * fails for reasons that have nothing to do with whether the *content* is
 * current: it broke the moment the fallback origin changed, even though every
 * page and every line was correct.
 *
 * What this test is actually for is content freshness — a new page added to
 * PAGES, a changed price, a rewritten FAQ answer. Normalizing the origin keeps
 * that guarantee and drops the environment coupling.
 */
function normalizeOrigin(s: string) {
  return s.replace(/https?:\/\/[^\s)\]]+/g, (raw) => {
    try {
      // Drop scheme too: the committed file was generated against https and a
      // local fallback is http, which is not a content difference.
      return `<origin>${new URL(raw).pathname}`
    } catch {
      return raw
    }
  })
}

function marketingPages() {
  return PAGES.filter((p) => p.index)
}

/**
 * The canonical origin.
 *
 * This used to default to `https://estate360.vercel.com`, which 404s, and
 * because it was a *valid* string nothing noticed: the sitemap listed 404s,
 * canonicals pointed nowhere, and every link inside llms.txt was dead. The
 * whole GEO surface — the reason llms.txt, FAQPage and the AI-crawler rules in
 * robots.ts exist — was addressed to a domain that does not resolve.
 *
 * The behaviour is pinned here rather than the specific domain, because the
 * domain is a decision: what must not regress is that the env var is honoured
 * and that an unset value degrades to something visibly local.
 */
describe("canonical origin (resolveBaseUrl)", () => {
  it("uses NEXT_PUBLIC_SITE_URL when set", () => {
    expect(resolveBaseUrl({ NEXT_PUBLIC_SITE_URL: "https://crm.example.com" })).toBe(
      "https://crm.example.com"
    )
  })

  it("strips a trailing slash so paths do not double up", () => {
    expect(resolveBaseUrl({ NEXT_PUBLIC_SITE_URL: "https://crm.example.com/" })).toBe(
      "https://crm.example.com"
    )
    expect(resolveBaseUrl({ NEXT_PUBLIC_SITE_URL: "https://crm.example.com///" })).toBe(
      "https://crm.example.com"
    )
  })

  it("ignores a blank value rather than emitting an empty origin", () => {
    expect(resolveBaseUrl({ NEXT_PUBLIC_SITE_URL: "   " })).toBe(
      "http://localhost:3000"
    )
  })

  it("falls back to localhost, never to a guessed production domain", () => {
    // The regression: a hardcoded fallback that happened to be a dead domain.
    const fallback = resolveBaseUrl({})
    expect(fallback).toBe("http://localhost:3000")
    expect(fallback).not.toMatch(/vercel\.app|vercel\.com/)
  })

  it("warns when unset in production", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {})
    try {
      resolveBaseUrl({ NODE_ENV: "production" })
      expect(warn).toHaveBeenCalled()
      expect(String(warn.mock.calls[0][0])).toMatch(/NEXT_PUBLIC_SITE_URL/)
    } finally {
      warn.mockRestore()
    }
  })

  it("does not warn in development", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {})
    try {
      resolveBaseUrl({ NODE_ENV: "development" })
      expect(warn).not.toHaveBeenCalled()
    } finally {
      warn.mockRestore()
    }
  })

  it("is a usable absolute origin, which every derived URL depends on", () => {
    expect(() => new URL(`${BASE_URL}/pricing`)).not.toThrow()
  })

  it(".env.example does not ship a domain that is already dead", () => {
    // The example file is what a new machine copies. Pointing it at a 404 is
    // how this mistake gets made twice.
    const example = read(".env.example")
    expect(example).toContain("NEXT_PUBLIC_SITE_URL")
    expect(example).not.toContain("estate360.vercel.com")
  })
})

describe("keyword source of truth", () => {
  it("gives every page exactly one primary term", () => {
    // Two pages chasing one term means the site competes with itself. A page
    // with no term is a page nobody decided should exist.
    for (const p of marketingPages()) {
      if (p.path === "/privacy" || p.path === "/terms") continue
      expect(p.primary, `${p.path} has no primary keyword`).toBeTruthy()
      expect(p.primary.length).toBeGreaterThan(4)
    }

    const primaries = marketingPages()
      .map((p) => p.primary)
      .filter(Boolean)
    expect(new Set(primaries).size).toBe(primaries.length)
  })

  it("keeps titles inside the SERP display range", () => {
    // Google truncates around 60 characters. A longer title is not wrong, it is
    // just paying for a suffix nobody reads.
    for (const p of PAGES) {
      expect(p.title.length, `${p.path} title is ${p.title.length} chars`).toBeLessThanOrEqual(70)
      expect(p.title, `${p.path} title carries no brand`).toContain("Estate360")
    }
  })

  it("keeps descriptions in the range that earns a click", () => {
    for (const p of PAGES) {
      // Only indexed pages need a clickable description. A noindex page's meta
      // description is never rendered in a SERP, so holding it to the same
      // length rule would be enforcing a constraint nothing observes.
      if (!p.index) continue
      expect(
        p.description.length,
        `${p.path} description is ${p.description.length} chars`
      ).toBeGreaterThanOrEqual(110)
      expect(p.description.length).toBeLessThanOrEqual(165)
    }
  })

  it("has a unique description per page", () => {
    const seen = new Map<string, string>()
    for (const p of PAGES) {
      const prev = seen.get(p.description)
      expect(prev, `${p.path} duplicates ${prev}`).toBeUndefined()
      seen.set(p.description, p.path)
    }
  })

  it("describes every marketing route, so a new page cannot ship with a bare title", () => {
    for (const route of ["/", "/product", "/pricing", "/contact", "/privacy", "/terms"]) {
      expect(PAGE_BY_PATH[route], `no PageSpec for ${route}`).toBeDefined()
    }
  })

  it("resolves metadata from the spec rather than hand-written strings", () => {
    for (const f of [
      "app/(marketing)/page.tsx",
      "app/(marketing)/product/page.tsx",
      "app/(marketing)/pricing/page.tsx",
      "app/(marketing)/contact/page.tsx",
      "app/(marketing)/privacy/page.tsx",
      "app/(marketing)/terms/page.tsx",
    ]) {
      const src = read(f)
      expect(src, `${f} should call pageMetadata({ path })`).toMatch(
        /pageMetadata\(\{\s*path:\s*"[^"]+"\s*\}\s*\)/
      )
      // A hand-passed title re-introduces exactly the drift this file prevents.
      expect(src, `${f} hardcodes its own title`).not.toMatch(/pageMetadata\(\{[^}]*title:/)
    }
  })
})

describe("structured data", () => {
  it("declares the organization once, with contactable details", () => {
    const org = organizationLd()
    expect(org["@type"]).toBe("Organization")
    expect(org.name).toBe(BRAND.name)
    expect(org.email).toBe(BRAND.email)
    expect(org.telephone).toBeTruthy()
    expect((org.address as Record<string, unknown>).addressCountry).toBe("IN")
  })

  it("prices the software in the markup, because an unpriced offer cannot be compared", () => {
    const app = softwareLd()
    const offers = app.offers as {
      priceCurrency: string
      lowPrice: string
      highPrice: string
      offers: unknown[]
    }
    expect(offers.priceCurrency).toBe("INR")
    expect(Number(offers.lowPrice)).toBeGreaterThan(0)
    expect(Number(offers.highPrice)).toBeGreaterThan(Number(offers.lowPrice))
    expect(offers.offers).toHaveLength(3)
  })

  it("quotes the same FAQ answers everywhere they appear", () => {
    // The AEO failure: an FAQ node whose text no longer matches the page.
    // Both must derive from the one array, and the pricing page must render
    // its subset visibly — a FAQ that exists only in JSON-LD is a violation.
    const node = faqLd("/") as { mainEntity: { name: string; acceptedAnswer: { text: string } }[] }
    expect(node.mainEntity).toHaveLength(FAQ.length)
    for (let i = 0; i < FAQ.length; i++) {
      expect(node.mainEntity[i].name).toBe(FAQ[i].q)
      expect(node.mainEntity[i].acceptedAnswer.text).toBe(FAQ[i].a)
    }

    const pricing = read("app/(marketing)/pricing/page.tsx")
    expect(pricing).toMatch(/FAQPage/)
    expect(pricing, "the pricing FAQ must be rendered, not just declared").toMatch(
      /PRICING_FAQ\.map/
    )
  })

  it("never invents social proof", () => {
    // Fabricated ratings and testimonials are the fastest route to a manual
    // action, and the reason this file is worth a test at all.
    const all = JSON.stringify([organizationLd(), softwareLd(), faqLd("/")])
    expect(all).not.toMatch(/aggregateRating/)
    expect(all).not.toMatch(/review/)
    expect(all).not.toMatch(/ratingValue/)
  })

  it("gives each page a distinct breadcrumb id", () => {
    const a = breadcrumbLd([{ name: "Home", path: "/" }, { name: "Product", path: "/product" }])
    const positions = (a.itemListElement as { position: number }[]).map((i) => i.position)
    expect(positions).toEqual([1, 2])
    expect((a.itemListElement as { name: string }[])[0].name).toBe("Home")
  })
})

describe("llms.txt (GEO)", () => {
  const short = llmsTxt()
  const full = llmsFullTxt()

  it("keeps the map small enough to sit in a context window whole", () => {
    // The entire point of the short form. 341 words is a page of reading; if
    // this ever crosses a few thousand, agents stop loading it and the file has
    // failed at its one job.
    const words = short.split(/\s+/).length
    expect(words).toBeLessThan(600)
  })

  it("leads with an H1 and a summary blockquote, per the spec", () => {
    expect(short.split("\n")[0]).toBe(`# ${BRAND.name}`)
    expect(short).toMatch(/^> .+/m)
  })

  it("uses absolute URLs, so a model can fetch them from the file alone", () => {
    for (const [, url] of short.matchAll(/\]\(([^)]+)\)/g)) {
      expect(url, `relative link ${url}`).toMatch(/^https?:\/\//)
    }
  })

  it("answers the questions a model is actually asked, in the long form", () => {
    for (const needle of [
      "## What it is",
      "## Product areas",
      "## Pricing",
      "## FAQ",
      "## Contact",
    ]) {
      expect(full).toContain(needle)
    }
    // The four things a buyer asks first, in the file rather than behind six
    // links and six round-trips.
    for (const term of ["₹1,499", "RERA", "Gujarati", "export"]) {
      expect(full.toLowerCase()).toContain(term.toLowerCase())
    }
  })

  it("states prices that match the pricing page", () => {
    const app = softwareLd()
    const offers = app.offers as { offers: { price: string }[] }
    for (const offer of offers.offers) {
      expect(full).toContain(offer.price)
    }
  })

  it("is generated into public/ by the build, and the checked-in copy is current", () => {
    // A stale llms.txt is worse than none: a model will confidently cite the
    // old version while the page it describes has moved on.
    //
    // Compared with line endings and origins normalized: `git config
    // core.autocrlf=true` checks these out with CRLF on Windows while the
    // generator emits LF, and the committed file's absolute URLs depend on
    // whichever NEXT_PUBLIC_SITE_URL was set when it was generated. Neither is
    // a content-staleness signal.
    const onDisk = normalizeOrigin(normalizeEol(read("public/llms.txt")))
    const onDiskFull = normalizeOrigin(normalizeEol(read("public/llms-full.txt")))
    expect(onDisk).toBe(normalizeOrigin(normalizeEol(short)))
    expect(onDiskFull).toBe(normalizeOrigin(normalizeEol(full)))
  })

  it("is wired into the build so it cannot drift", () => {
    const pkg = JSON.parse(read("package.json"))
    expect(pkg.scripts.prebuild).toContain("write-llms-txt")
    expect(pkg.scripts["seo:llms"]).toContain("write-llms-txt")
  })

  it("is reachable and linked as a markdown alternate", () => {
    expect(fs.existsSync(path.join(REPO_ROOT, "public/llms.txt"))).toBe(true)
    expect(fs.existsSync(path.join(REPO_ROOT, "public/llms-full.txt"))).toBe(true)

    // The base URL reaches the layout through the content module, not a
    // literal, so a staging or custom domain is a one-line env change.
    const layout = read("app/layout.tsx")
    expect(layout).toMatch(/rel="alternate"/)
    expect(layout).toMatch(/text\/markdown/)
    expect(layout).toMatch(/from "@\/content\/marketing"/)
    expect(layout).toContain("BASE_URL")
    expect(BASE_URL).toMatch(/^https?:\/\//)
  })
})

describe("crawler policy", () => {
  const robots = read("app/robots.ts")

  it("keeps tenant inventory out of every crawler", () => {
    // A builder's project, unit and price list is the most commercially
    // sensitive thing this product holds. `/sites/*` in a public sitemap would
    // hand it to a competitor.
    expect(robots).toMatch(/\/sites\//)
    expect(robots).toMatch(/\/api\//)
    expect(robots).toMatch(/\/\*\/dashboard/)
  })

  it("explicitly allows the AI answer engines over the marketing surface", () => {
    // Listing them by name rather than relying on the wildcard rule: several
    // identify as a generic bot and would otherwise be caught by the disallows.
    for (const agent of ["GPTBot", "ClaudeBot", "PerplexityBot", "Google-Extended"]) {
      expect(robots).toContain(agent)
    }
  })

  it("builds the sitemap from the same spec, so pages cannot drift apart", () => {
    const sitemap = read("app/sitemap.ts")
    expect(sitemap).toContain("PAGES")
    // /login has no content and a login page in a sitemap is a thin-content
    // signal. /thank-you is the same.
    expect(sitemap).not.toMatch(/path:\s*"\/login"/)
    expect(PAGE_BY_PATH["/thank-you"].index).toBe(false)
  })
})

describe("copy voice", () => {
  const banned =
    /\b(seamless(ly)?|revolution(ary|ise|ize)|game[- ]chang(ing|er)|cutting[- ]edge|empower(s|ed)?|leverage(s|d)?|robust|world[- ]class|unlock|transform your|supercharge|effortless(ly)?)\b/i

  it("uses no consultant register in any marketing string", () => {
    // The single most reliable signal that a page was written by a committee
    // rather than by someone who has used the product. It also correlates with
    // pages that convert badly, because the reader cannot check any of it.
    const strings = [
      ...PAGES.map((p) => `${p.title} ${p.description}`),
      ...FAQ.map((f) => `${f.q} ${f.a}`),
      llmsTxt(),
      llmsFullTxt(),
    ]
    for (const s of strings) {
      expect(s, `banned phrase: ${s.match(banned)?.[0]}`).not.toMatch(banned)
    }
  })

  it("leads every FAQ answer with the substance, not a preamble", () => {
    for (const f of FAQ) {
      expect(f.a.length, `${f.q} answer is too long to be quoted`).toBeLessThan(320)
      expect(f.a).not.toMatch(/^(Great question|At Estate360|In today's|We believe)/i)
    }
  })

  it("names a mechanism in every capability claim", () => {
    // A claim a buyer could verify on Monday morning. "200m", "eight
    // milestones", "₹1,499" — specific enough to check.
    expect(llmsFullTxt()).toMatch(/200m/)
    expect(llmsFullTxt()).toMatch(/eight/)
  })
})
