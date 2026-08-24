import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import {
  ArrowLeft,
  Briefcase,
  Building2,
  Globe,
  Mail,
  Phone,
} from "lucide-react"

import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { formatDate, fullName } from "@/lib/format"
import { getContactDetail, listWorkspaceMembers } from "@/modules/contacts/queries"
import { formatMoney } from "@/lib/format"
import { ContactDetailActions } from "@/components/contacts/contact-detail-actions"
import { ActivityComposer } from "@/components/activities/activity-composer"
import { Timeline } from "@/components/activities/timeline"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

export const metadata: Metadata = { title: "Contact" }

export default async function ContactDetailPage({
  params,
}: {
  params: Promise<{ workspace: string; id: string }>
}) {
  const { workspace: slug, id } = await params
  const session = await auth()

  const workspace = await db.workspace.findUnique({ where: { slug } })
  if (!workspace) notFound()

  const membership = session?.user?.id
    ? await db.workspaceMember.findUnique({
        where: {
          workspaceId_userId: {
            workspaceId: workspace.id,
            userId: session.user.id,
          },
        },
      })
    : null
  if (!membership) notFound()

  const contact = await getContactDetail(workspace.id, id)
  if (!contact) notFound()

  const [members, tags, orgs] = await Promise.all([
    listWorkspaceMembers(workspace.id),
    db.tag.findMany({
      where: { workspaceId: workspace.id },
      orderBy: { name: "asc" },
      select: { id: true, name: true, color: true },
    }),
    db.organization.findMany({
      where: { workspaceId: workspace.id },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ])

  const users = new Map(members.map((m) => [m.user.id, { name: m.user.name }]))
  const name = fullName(contact.firstName, contact.lastName)
  const totalValue = contact.deals.reduce((sum, d) => sum + (d.value ?? 0), 0)

  return (
    <div className="flex flex-col gap-5">
      <Button
        variant="ghost"
        size="sm"
        className="w-fit -ml-2 text-muted-foreground"
        render={<Link href={`/${slug}/contacts`} />}
      >
        <ArrowLeft data-icon="inline-start" />
        Contacts
      </Button>

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <Avatar className="size-14">
            <AvatarFallback className="text-lg">{name.slice(0, 2).toUpperCase()}</AvatarFallback>
          </Avatar>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">{name}</h1>
            <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
              {contact.jobTitle && (
                <span className="inline-flex items-center gap-1">
                  <Briefcase className="size-3.5" />
                  {contact.jobTitle}
                </span>
              )}
              {contact.organization && (
                <Link
                  href={`/${slug}/organizations/${contact.organization.id}`}
                  className="inline-flex items-center gap-1 hover:underline"
                >
                  <Building2 className="size-3.5" />
                  {contact.organization.name}
                </Link>
              )}
              <span>Added {formatDate(contact.createdAt)}</span>
            </p>
          </div>
        </div>
        <ContactDetailActions
          workspaceId={workspace.id}
          workspaceSlug={slug}
          contactId={contact.id}
          members={members}
          tags={tags}
          currentOwnerId={contact.ownerId}
          currentTagIds={contact.tags.map((t) => t.tag.id)}
          role={membership.role}
          organizations={orgs}
          contact={{
            id: contact.id,
            firstName: contact.firstName,
            lastName: contact.lastName,
            email: contact.email,
            phone: contact.phone,
            jobTitle: contact.jobTitle,
            linkedinUrl: contact.linkedinUrl,
            organizationId: contact.organizationId,
          }}
        />
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        {/* Left column: info + tags */}
        <div className="flex flex-col gap-5">
          <Card>
            <CardHeader>
              <CardTitle>Contact info</CardTitle>
              <CardDescription>Details and links</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-2.5 text-sm">
              <InfoRow icon={<Mail className="size-4" />} label="Email">
                {contact.email ? (
                  <a
                    href={`mailto:${contact.email}`}
                    className="text-primary hover:underline"
                  >
                    {contact.email}
                  </a>
                ) : (
                  <span className="text-muted-foreground/60">—</span>
                )}
              </InfoRow>
              <InfoRow icon={<Phone className="size-4" />} label="Phone">
                {contact.phone ? (
                  <a href={`tel:${contact.phone}`} className="hover:underline">
                    {contact.phone}
                  </a>
                ) : (
                  <span className="text-muted-foreground/60">—</span>
                )}
              </InfoRow>
              <InfoRow icon={<Globe className="size-4" />} label="LinkedIn">
                {contact.linkedinUrl ? (
                  <a
                    href={contact.linkedinUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="truncate text-primary hover:underline"
                  >
                    {contact.linkedinUrl.replace(/^https?:\/\//, "")}
                  </a>
                ) : (
                  <span className="text-muted-foreground/60">—</span>
                )}
              </InfoRow>
              <InfoRow label="Updated">
                <span>{formatDate(contact.updatedAt)}</span>
              </InfoRow>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Tags</CardTitle>
              <CardDescription>Assigned labels</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-1.5">
                {contact.tags.length === 0 && (
                  <p className="text-sm text-muted-foreground">No tags yet.</p>
                )}
                {contact.tags.map(({ tag }) => (
                  <Badge
                    key={tag.id}
                    variant="outline"
                    style={{ borderColor: tag.color, color: tag.color }}
                  >
                    {tag.name}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Pipeline value</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold">{formatMoney(totalValue)}</p>
              <p className="text-xs text-muted-foreground">
                {contact.deals.length} open deal
                {contact.deals.length !== 1 ? "s" : ""}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Right column: deals + activity */}
        <div className="flex flex-col gap-5 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Deals</CardTitle>
              <CardDescription>Linked pipeline records</CardDescription>
            </CardHeader>
            <CardContent>
              {contact.deals.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  No deals linked to this contact yet.
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead>Deal</TableHead>
                      <TableHead>Stage</TableHead>
                      <TableHead className="text-right">Value</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {contact.deals.map((deal) => (
                      <TableRow key={deal.id}>
                        <TableCell>
                          <Link
                            href={`/${slug}/deals/${deal.id}`}
                            className="font-medium hover:underline"
                          >
                            {deal.title}
                          </Link>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            style={{ borderColor: deal.stage.color, color: deal.stage.color }}
                          >
                            {deal.stage.name}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          {formatMoney(deal.value, deal.currency)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Activity</CardTitle>
              <CardDescription>Timeline for this contact</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <ActivityComposer
                workspaceId={workspace.id}
                contactId={contact.id}
                members={members}
              />
              <Timeline
                activities={contact.activities}
                users={users}
                workspaceId={workspace.id}
                workspaceSlug={slug}
              />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

function InfoRow({
  icon,
  label,
  children,
}: {
  icon?: React.ReactNode
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <span className="inline-flex items-center gap-2 text-muted-foreground">
        {icon}
        {label}
      </span>
      <span className="min-w-0 max-w-[60%] truncate text-right">{children}</span>
    </div>
  )
}

