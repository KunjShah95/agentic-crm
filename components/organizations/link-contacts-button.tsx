"use client"

import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Link2 } from "lucide-react"

import { linkContactToOrgAction } from "@/lib/actions/organizations"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"

export function LinkContactsButton({
  workspaceId,
  orgId,
  contact,
}: {
  workspaceId: string
  orgId: string
  contact: { id: string; name: string; email: string | null }
}) {
  const router = useRouter()

  async function link() {
    const result = await linkContactToOrgAction(workspaceId, orgId, contact.id)
    if (result.error) {
      toast.error(result.error.message)
      return
    }
    toast.success(`Linked ${contact.name}`)
    router.refresh()
  }

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={link}
      className="gap-2"
    >
      <Avatar className="size-5">
        <AvatarFallback className="text-[9px]">
          {contact.name.slice(0, 2).toUpperCase()}
        </AvatarFallback>
      </Avatar>
      <span className="max-w-40 truncate">{contact.name}</span>
      <Link2 className="size-3.5 text-muted-foreground" />
    </Button>
  )
}
