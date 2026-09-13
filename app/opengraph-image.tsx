import { ImageResponse } from "next/og"

export const alt = "Estate360 — Ahmedabad sites from foundation to possession on loop"
export const size = { width: 1200, height: 630 }
export const contentType = "image/png"

// Mirrors the landing's design system: warm parchment base, single amber
// accent, ink text. One loop motif — no gradient soup, restraint is the brand.
const INK = "#17120A"
const MUTED = "#5C5346"
const BRAND = "#C27803"
const PARCHMENT = "#F7F3EC"

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: `radial-gradient(900px 420px at 88% -10%, rgba(194,120,3,0.12), transparent 60%), linear-gradient(145deg, #FBF8F2 0%, ${PARCHMENT} 45%, #E3DACB 100%)`,
          padding: 64,
          fontFamily: "system-ui, sans-serif",
          position: "relative",
        }}
      >
        {/* Header: lockup */}
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: 14,
              background: INK,
              color: PARCHMENT,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 28,
              fontWeight: 700,
            }}
          >
            E
          </div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <span style={{ fontSize: 22, fontWeight: 700, letterSpacing: 6, color: INK }}>ESTATE360</span>
            <span style={{ fontSize: 15, color: MUTED, letterSpacing: 3 }}>CRM · AHMEDABAD</span>
          </div>
          <div
            style={{
              marginLeft: "auto",
              display: "flex",
              alignItems: "center",
              gap: 10,
              border: `1px solid rgba(23,18,10,0.18)`,
              borderRadius: 999,
              padding: "8px 18px",
              background: "rgba(255,255,255,0.55)",
            }}
          >
            <span style={{ width: 8, height: 8, borderRadius: 999, background: BRAND, display: "flex" }} />
            <span style={{ fontSize: 15, fontWeight: 600, letterSpacing: 2, color: INK }}>MULTI-TENANT · WORKSPACE-SCOPED</span>
          </div>
        </div>

        {/* Hero statement with amber loop accent */}
        <div style={{ display: "flex", flexDirection: "column", gap: 18, maxWidth: 960 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
            <div
              style={{
                width: 46,
                height: 46,
                borderRadius: "50%",
                border: `6px solid ${BRAND}`,
                borderTopColor: "transparent",
                display: "flex",
                flexShrink: 0,
              }}
            />
            <div style={{ fontSize: 58, fontWeight: 650, lineHeight: 1.04, color: INK, letterSpacing: -1.6 }}>
              Foundation to possession — on loop.
            </div>
          </div>
          <div style={{ fontSize: 23, color: MUTED, lineHeight: 1.35 }}>
            Inventory · HOLD→BOOKING→CLP · GPS site visits · RERA documents · WhatsApp inbox · AI · NAAR pool
          </div>
        </div>

        {/* Stat strip — mirrors the landing's stats bento */}
        <div style={{ display: "flex" }}>
          {[
            { k: "COST SHEET", v: "18 sec" },
            { k: "HOLD → BOOKING", v: "48 sec" },
            { k: "SITE GPS", v: "200 m" },
            { k: "RERA DEMAND #1", v: "9 sec" },
          ].map((s, i) => (
            <div
              key={s.k}
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 6,
                flex: 1,
                paddingLeft: i === 0 ? 0 : 24,
                borderLeft: i === 0 ? "none" : "1px solid rgba(23,18,10,0.14)",
              }}
            >
              <span style={{ fontSize: 14, letterSpacing: 2.5, color: MUTED }}>{s.k}</span>
              <span style={{ fontSize: 26, fontWeight: 650, color: INK }}>{s.v}</span>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 17, color: MUTED }}>
          <span>Mondeal Heights · SG Highway · estate360.in</span>
          <span style={{ color: BRAND, fontWeight: 600 }}>estate360.vercel.com</span>
        </div>
      </div>
    ),
    { ...size }
  )
}
