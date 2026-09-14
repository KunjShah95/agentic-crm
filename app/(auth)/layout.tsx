import Link from "next/link"
import { Layers } from "lucide-react"
import { redirect } from "next/navigation"

import { auth } from "@/lib/auth"

export default async function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await auth()
  if (session?.workspaces?.length) {
    redirect(`/${session.workspaces[0].slug}/today`)
  }

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center gap-6 p-6">
      {/* soft backdrop */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 overflow-hidden"
      >
        <div className="absolute -top-40 left-1/2 h-96 w-[42rem] -translate-x-1/2 rounded-full bg-brand/10 blur-3xl" />
        <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-brand/20 to-transparent" />
      </div>

      <div className="relative z-10 flex w-full max-w-sm flex-col gap-8">
        <Link href="/" className="flex flex-col items-center gap-2">
          <span className="flex size-11 items-center justify-center rounded-xl bg-brand shadow-sm">
            <Layers className="size-5 text-brand-foreground" aria-hidden />
          </span>
          <div className="text-center">
            <h1 className="text-[15px] font-semibold tracking-[0.18em]">
              ESTATE360{" "}
              <span className="font-light tracking-[0.12em] text-muted-foreground">CRM</span>
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              One loop, from foundation to possession.
            </p>
          </div>
        </Link>
        {children}
      </div>
    </div>
  )
}
