"use client"

import { useEffect } from "react"
import { captureUtm } from "@/lib/utm"

/** Mounts once per page load and snapshots ad-attribution params before
 *  client-side navigation strips them from the URL. */
export function UtmCapture() {
  useEffect(() => {
    captureUtm()
  }, [])
  return null
}
