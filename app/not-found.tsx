import Link from "next/link"
import { Button } from "@/components/ui/button"
import { ArrowRight, Layers } from "lucide-react"
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Page not found",
  description: "This Estate360 page does not exist. Head home or contact the Ahmedabad team.",
  robots: { index: false, follow: true },
}

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <div className="relative flex flex-1 flex-col items-center justify-center overflow-hidden px-6 py-20 text-center">
        <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-b from-brand-soft/60 via-background to-background" />
        <Link href="/" className="mb-8 flex items-center gap-2.5" aria-label="Estate360 home">
          <span className="flex size-9 items-center justify-center rounded-lg bg-foreground text-background">
            <Layers className="size-4" aria-hidden />
          </span>
          <span className="text-[13px] font-semibold tracking-[0.18em]">ESTATE360</span>
          <span className="text-[13px] font-light tracking-[0.12em] text-muted-foreground">CRM</span>
        </Link>
        <p className="font-mono text-[12px] tracking-[0.2em] text-muted-foreground">404 · LOOP BROKEN</p>
        <h1 className="mt-3 max-w-[520px] font-display text-[40px] font-[600] leading-[1.05] tracking-[-0.03em] sm:text-[52px]">
          This page isn&apos;t on the site plan.
        </h1>
        <p className="mt-4 max-w-[420px] text-[15px] leading-6 text-muted-foreground">
          The URL may have moved, or the unit never existed. Let&apos;s get you back to inventory that does.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Button size="lg" className="h-11 gap-2 rounded-full px-7" render={<Link href="/" />}>
            Back home <ArrowRight className="size-4" aria-hidden />
          </Button>
          <Button size="lg" variant="outline" className="h-11 rounded-full px-6" render={<Link href="/contact" />}>
            Contact us
          </Button>
        </div>
        <nav className="mt-10 flex flex-wrap justify-center gap-4 text-sm text-muted-foreground" aria-label="Helpful links">
          <Link href="/product" className="hover:text-foreground">
            Product
          </Link>
          <Link href="/pricing" className="hover:text-foreground">
            Pricing
          </Link>
          <Link href="/privacy" className="hover:text-foreground">
            Privacy
          </Link>
          <Link href="/terms" className="hover:text-foreground">
            Terms
          </Link>
        </nav>
      </div>
    </div>
  )
}
