"use client"

import * as React from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { Search, X } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

export function SearchInput({ initialQuery }: { initialQuery: string }) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [query, setQuery] = React.useState(initialQuery)

  React.useEffect(() => {
    const timer = setTimeout(() => {
      const params = new URLSearchParams(searchParams.toString())
      const q = query.trim()
      if (q) params.set("q", q)
      else params.delete("q")
      router.replace(`${pathname}?${params.toString()}`)
    }, 300)
    return () => clearTimeout(timer)
  }, [query]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="relative max-w-xl">
      <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        autoFocus
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search contacts, companies, and deals…"
        className="h-10 pl-9 pr-9 text-base"
      />
      {query && (
        <Button
          variant="ghost"
          size="icon"
          className="absolute top-1/2 right-1 size-7 -translate-y-1/2"
          onClick={() => setQuery("")}
        >
          <X className="size-4" />
          <span className="sr-only">Clear</span>
        </Button>
      )}
    </div>
  )
}
