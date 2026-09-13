import { ImageResponse } from "next/og"

export const size = { width: 32, height: 32 }
export const contentType = "image/png"

export default function Icon() {
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
          borderRadius: 8,
          color: "#F7F3EC",
          fontSize: 18,
          fontWeight: 700,
          letterSpacing: -1,
        }}
      >
        L
      </div>
    ),
    { ...size }
  )
}
