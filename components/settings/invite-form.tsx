"use client"

import * as React from "react"
import { toast } from "sonner"
import { Check, Copy, Link2, LoaderCircle, Mail } from "lucide-react"

import { inviteMemberAction } from "@/lib/actions/settings"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

export function InviteForm({ workspaceId }: { workspaceId: string }) {
  const [email, setEmail] = React.useState("")
  const [role, setRole] = React.useState("MEMBER")
  const [inviteLink, setInviteLink] = React.useState<string | null>(null)
  const [copied, setCopied] = React.useState(false)
  const [isPending, startTransition] = React.useTransition()

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!email.trim()) return
    setInviteLink(null)
    startTransition(async () => {
      const result = await inviteMemberAction(workspaceId, {
        email: email.trim(),
        role,
      })
      if (result.error) {
        toast.error(result.error.message)
        return
      }
      const link = `${window.location.origin}/invite/${result.data.token}`
      setInviteLink(link)
      setEmail("")
      toast.success("Invite created")
    })
  }

  async function copyLink() {
    if (!inviteLink) return
    await navigator.clipboard.writeText(inviteLink)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
    toast.success("Invite link copied")
  }

  return (
    <div className="flex flex-col gap-3">
      <form onSubmit={onSubmit} className="flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <Mail className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="teammate@company.com"
            className="pl-8"
            required
          />
        </div>
        <Select value={role} onValueChange={(v) => v && setRole(v)}>
          <SelectTrigger className="w-full sm:w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="MEMBER">Member</SelectItem>
            <SelectItem value="ADMIN">Admin</SelectItem>
          </SelectContent>
        </Select>
        <Button type="submit" disabled={isPending || !email.trim()}>
          {isPending ? (
            <LoaderCircle data-icon="inline-start" className="animate-spin" />
          ) : (
            <Link2 data-icon="inline-start" />
          )}
          Send invite
        </Button>
      </form>

      {inviteLink && (
        <div className="flex items-center gap-2 rounded-lg border bg-muted/40 px-3 py-2">
          <code className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
            {inviteLink}
          </code>
          <Button variant="ghost" size="sm" onClick={copyLink}>
            {copied ? (
              <Check className="size-4 text-primary" />
            ) : (
              <Copy className="size-4" />
            )}
            {copied ? "Copied" : "Copy"}
          </Button>
        </div>
      )}
    </div>
  )
}
