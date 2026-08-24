import { redirect } from "next/navigation"

import { auth } from "@/lib/auth"

export default async function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await auth()
  if (session?.workspaces?.length) {
    redirect(`/${session.workspaces[0].slug}/contacts`)
  }

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center gap-6 p-6">
      {/* soft backdrop */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 overflow-hidden"
      >
        <div className="absolute -top-40 left-1/2 h-96 w-[42rem] -translate-x-1/2 rounded-full bg-primary/10 blur-3xl" />
        <div className="absolute -bottom-48 right-0 h-80 w-80 rounded-full bg-violet-500/10 blur-3xl" />
      </div>

      <div className="relative z-10 flex w-full max-w-sm flex-col gap-8">
        <div className="flex flex-col items-center gap-2">
          <div className="flex size-11 items-center justify-center rounded-xl bg-primary text-lg font-bold text-primary-foreground shadow-lg shadow-primary/25">
            ◐
          </div>
          <div className="text-center">
            <h1 className="text-lg font-semibold tracking-tight">Loop CRM</h1>
            <p className="text-sm text-muted-foreground">
              Your workspace, one loop at a time
            </p>
          </div>
        </div>
        {children}
      </div>
    </div>
  )
}
