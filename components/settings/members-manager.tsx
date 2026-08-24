"use client"

import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { ShieldCheck, Shield, Trash2, UserRound, X } from "lucide-react"

import {
  cancelInviteAction,
  removeMemberAction,
  updateMemberRoleAction,
} from "@/lib/actions/settings"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { formatDate, initials } from "@/lib/format"

const ROLE_BADGE: Record<string, { label: string; className: string }> = {
  OWNER: { label: "Owner", className: "" },
  ADMIN: { label: "Admin", className: "bg-primary/10 text-primary border-primary/20" },
  MEMBER: { label: "Member", className: "" },
}

export function MembersManager({
  workspaceId,
  members,
  invites,
  currentUserId,
  canManage,
}: {
  workspaceId: string
  members: {
    userId: string
    role: string
    createdAt: Date
    user: { id: string; name: string; email: string; avatarUrl: string | null }
  }[]
  invites: {
    id: string
    email: string
    role: string
    expiresAt: Date
    accepted: boolean
  }[]
  currentUserId: string
  canManage: boolean
}) {
  const router = useRouter()

  async function changeRole(userId: string, role: string) {
    const result = await updateMemberRoleAction(
      workspaceId,
      userId,
      role as "ADMIN" | "MEMBER"
    )
    if (result.error) toast.error(result.error.message)
    else {
      toast.success("Role updated")
      router.refresh()
    }
  }

  async function remove(userId: string, name: string) {
    const result = await removeMemberAction(workspaceId, userId)
    if (result.error) toast.error(result.error.message)
    else {
      toast.success(`${name} removed`)
      router.refresh()
    }
  }

  async function cancelInvite(inviteId: string) {
    const result = await cancelInviteAction(workspaceId, inviteId)
    if (result.error) toast.error(result.error.message)
    else {
      toast.success("Invite cancelled")
      router.refresh()
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Members */}
      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead>Member</TableHead>
              <TableHead>Role</TableHead>
              <TableHead className="hidden sm:table-cell">Joined</TableHead>
              <TableHead className="w-24" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {members.map((m) => {
              const badge = ROLE_BADGE[m.role] ?? ROLE_BADGE.MEMBER
              const isSelf = m.user.id === currentUserId
              return (
                <TableRow key={m.userId}>
                  <TableCell>
                    <div className="flex items-center gap-2.5">
                      <Avatar className="size-8">
                        <AvatarImage src={m.user.avatarUrl ?? undefined} alt={m.user.name} />
                        <AvatarFallback>{initials(m.user.name)}</AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">
                          {m.user.name}
                          {isSelf && (
                            <span className="ml-1.5 text-xs font-normal text-muted-foreground">
                              (you)
                            </span>
                          )}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">
                          {m.user.email}
                        </p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    {m.role === "OWNER" ? (
                      <Badge variant="outline" className="gap-1">
                        <ShieldCheck className="size-3" />
                        Owner
                      </Badge>
                    ) : canManage ? (
                      <Select
                        value={m.role}
                        onValueChange={(role) => role && changeRole(m.user.id, role)}
                      >
                        <SelectTrigger className="h-8 w-32">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="ADMIN">
                            <span className="inline-flex items-center gap-1.5">
                              <Shield className="size-3.5" />
                              Admin
                            </span>
                          </SelectItem>
                          <SelectItem value="MEMBER">
                            <span className="inline-flex items-center gap-1.5">
                              <UserRound className="size-3.5" />
                              Member
                            </span>
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    ) : (
                      <Badge variant="outline">{badge.label}</Badge>
                    )}
                  </TableCell>
                  <TableCell className="hidden text-sm text-muted-foreground sm:table-cell">
                    {formatDate(m.createdAt)}
                  </TableCell>
                  <TableCell>
                    {canManage && m.role !== "OWNER" && !isSelf && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-8 text-muted-foreground hover:text-destructive"
                        onClick={() => remove(m.user.id, m.user.name)}
                      >
                        <Trash2 />
                        <span className="sr-only">Remove</span>
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>

      {/* Pending invites */}
      {invites.length > 0 && (
        <div className="flex flex-col gap-2">
          <h3 className="text-sm font-semibold text-muted-foreground">
            Pending invites
          </h3>
          {invites.map((invite) => (
            <div
              key={invite.id}
              className="flex items-center gap-3 rounded-lg border bg-card px-3.5 py-2.5"
            >
              <MailIcon />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{invite.email}</p>
                <p className="text-xs text-muted-foreground">
                  {invite.role} · expires {formatDate(invite.expiresAt)}
                </p>
              </div>
              {canManage && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-8"
                  onClick={() => cancelInvite(invite.id)}
                >
                  <X />
                  <span className="sr-only">Cancel invite</span>
                </Button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function MailIcon() {
  return (
    <span className="flex size-8 items-center justify-center rounded-md bg-muted">
      <svg
        className="size-4 text-muted-foreground"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <rect width="20" height="16" x="2" y="4" rx="2" />
        <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
      </svg>
    </span>
  )
}
