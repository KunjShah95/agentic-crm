import { ImageResponse } from "next/og"

export const size = { width: 180, height: 180 }
export const contentType = "image/png"

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#17120A",
          borderRadius: 36,
          color: "#F7F3EC",
          fontSize: 96,
          fontWeight: 700,
          letterSpacing: -4,
        }}
      >
        L
      </div>
    ),
    { ...size }
  )
}
