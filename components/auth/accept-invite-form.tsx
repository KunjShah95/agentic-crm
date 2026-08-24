"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { useSession } from "next-auth/react"
import { LoaderCircle } from "lucide-react"

import { acceptInviteAction } from "@/lib/actions/auth"
import { Button } from "@/components/ui/button"
import { Alert } from "@/components/ui/alert"

export function AcceptInviteForm({
  token,
  workspaceName,
}: {
  token: string
  workspaceName: string
}) {
  const router = useRouter()
  const { update } = useSession()
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function onAccept() {
    setError(null)
    startTransition(async () => {
      const result = await acceptInviteAction(token)
      if (result.error) {
        setError(result.error.message)
        return
      }
      // Refresh the session JWT so the new membership appears in the switcher
      await update({ activeWorkspaceId: result.data.workspaceId })
      router.push(result.data.redirectTo)
      router.refresh()
    })
  }

  return (
    <div className="flex flex-col gap-4">
      {error && <Alert variant="destructive">{error}</Alert>}
      <Button onClick={onAccept} disabled={isPending} className="w-full">
        {isPending && (
          <LoaderCircle data-icon="inline-start" className="animate-spin" />
        )}
        {isPending ? "Joining…" : `Join ${workspaceName}`}
      </Button>
    </div>
  )
}
