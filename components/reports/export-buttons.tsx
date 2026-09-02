"use client"

import { Button } from "@/components/ui/button"
import { Download, Printer } from "lucide-react"

export function ExportButtons({ snapshot }: { snapshot: unknown }) {
  const onCsv = () => {
    const blob = new Blob([JSON.stringify(snapshot, null, 2)], { type: "text/csv" })
    // real CSV is fetched via API below; fallback keeps button usable without API
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = "reports.json"
    a.click()
    URL.revokeObjectURL(url)
  }

  const onPrint = () => {
    window.print()
  }

  return (
    <div className="flex gap-2">
      <Button variant="outline" size="sm" className="rounded-full gap-1.5" onClick={onCsv}>
        <Download className="size-3.5" /> JSON
      </Button>
      <Button variant="outline" size="sm" className="rounded-full gap-1.5" onClick={onPrint}>
        <Printer className="size-3.5" /> Print / PDF
      </Button>
    </div>
  )
}
