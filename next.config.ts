import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // No remotePatterns. The site renders zero raster images — every surface is
    // built from the token layer and the shared gradient field, and the one
    // stock photo it did carry (contact/page.tsx) was removed because it
    // presented a generic office as the company's real premises. Re-add an entry
    // here only alongside a real, licensed asset, not as a convenience.
    remotePatterns: [],
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          // The old config sent a site-wide `X-Robots-Tag: index, follow` on
          // every response — including /api, /buyer and tenant routes. Google
          // merges header and meta robots, so the header was fighting the
          // per-page noindex decisions made in `content/marketing.ts`. Per-page
          // metadata is the single source of truth for indexing; this header
          // is removed rather than scoped down.
          { key: "X-Content-Type-Options", value: "nosniff" },
          // No site-wide X-Frame-Options: the public project micro-sites under
          // /sites/* are embeddable materials for builders, so a blanket DENY
          // would break their intended distribution. Tenant/app pages are
          // auth-walled and don't rely on framing, but forbidding framing on
          // them bought nothing over what auth already gives us.
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
        ],
      },
    ];
  },
};

export default nextConfig;
