import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import {
  ArrowLeft,
  Building2,
  CalendarDays,
  Percent,
  Users,
} from "lucide-react"

import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { formatDate, formatMoney } from "@/lib/format"
import { getDealDetail } from "@/modules/deals/queries"
import { listWorkspaceMembers } from "@/modules/contacts/queries"
import { ActivityComposer } from "@/components/activities/activity-composer"
import { Timeline } from "@/components/activities/timeline"
import { DealFormDialog } from "@/components/deals/deal-form-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

export const metadata: Metadata = { title: "Deal" }

export default async function DealDetailPage({
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

  const deal = await getDealDetail(workspace.id, id)
  if (!deal) notFound()

  const [members, contacts, orgs, stages] = await Promise.all([
    listWorkspaceMembers(workspace.id),
    db.contact.findMany({
      where: { workspaceId: workspace.id },
      orderBy: { firstName: "asc" },
      select: { id: true, firstName: true, lastName: true },
    }),
    db.organization.findMany({
      where: { workspaceId: workspace.id },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    db.pipelineStage.findMany({
      where: { workspaceId: workspace.id },
      orderBy: { order: "asc" },
      select: { id: true, name: true, color: true },
    }),
  ])

  const users = new Map(members.map((m) => [m.user.id, { name: m.user.name }]))
  const owner = users.get(deal.ownerId)

  return (
    <div className="flex flex-col gap-5">
      <Button
        variant="ghost"
        size="sm"
        className="w-fit -ml-2 text-muted-foreground"
        render={<Link href={`/${slug}/deals`} />}
      >
        <ArrowLeft data-icon="inline-start" />
        Deals
      </Button>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">{deal.title}</h1>
            <Badge
              variant="outline"
              style={{
                borderColor: deal.stage.color,
                color: deal.stage.color,
              }}
            >
              {deal.stage.name}
            </Badge>
          </div>
          <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
            {deal.organization && (
              <Link
                href={`/${slug}/organizations/${deal.organization.id}`}
                className="inline-flex items-center gap-1 hover:underline"
              >
                <Building2 className="size-3.5" />
                {deal.organization.name}
              </Link>
            )}
            {deal.contact && (
              <Link
                href={`/${slug}/contacts/${deal.contact.id}`}
                className="inline-flex items-center gap-1 hover:underline"
              >
                <Users className="size-3.5" />
                {deal.contact.firstName} {deal.contact.lastName}
              </Link>
            )}
            {owner && <span>Owner: {owner.name}</span>}
          </p>
        </div>
        <DealFormDialog
          workspaceId={workspace.id}
          stages={stages}
          contacts={contacts}
          organizations={orgs}
          members={members}
          deal={{
            id: deal.id,
            title: deal.title,
            stageId: deal.stageId,
            contactId: deal.contactId,
            organizationId: deal.organizationId,
            value: deal.value,
            currency: deal.currency,
            probability: deal.probability,
            expectedCloseDate: deal.expectedCloseDate,
            ownerId: deal.ownerId,
          }}
          trigger={<Button size="sm">Edit deal</Button>}
        />
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <div className="flex flex-col gap-5">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Deal summary</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <div className="flex items-baseline justify-between">
                <span className="text-sm text-muted-foreground">Value</span>
                <span className="text-2xl font-semibold tracking-tight">
                  {formatMoney(deal.value, deal.currency)}
                </span>
              </div>
              <SeparatorRow
                icon={<Percent className="size-4" />}
                label="Probability"
                value={
                  deal.probability != null ? `${deal.probability}%` : "—"
                }
              />
              <SeparatorRow
                icon={<CalendarDays className="size-4" />}
                label="Expected close"
                value={formatDate(deal.expectedCloseDate)}
              />
              <SeparatorRow
                label="Created"
                value={formatDate(deal.createdAt)}
              />
              <SeparatorRow label="Updated" value={formatDate(deal.updatedAt)} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Tags</CardTitle>
              <CardDescription>Labels on this deal</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-1.5">
                {deal.tags.length === 0 && (
                  <p className="text-sm text-muted-foreground">No tags yet.</p>
                )}
                {deal.tags.map(({ tag }) => (
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
        </div>

        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Activity</CardTitle>
              <CardDescription>
                Timeline · stage moves are logged automatically
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <ActivityComposer workspaceId={workspace.id} dealId={deal.id} members={members} />
              <Timeline
                activities={deal.activities}
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

function SeparatorRow({
  icon,
  label,
  value,
}: {
  icon?: React.ReactNode
  label: string
  value: string
}) {
  return (
    <div className="flex items-center justify-between border-t pt-3 text-sm">
      <span className="inline-flex items-center gap-2 text-muted-foreground">
        {icon}
        {label}
      </span>
      <span className="font-medium">{value}</span>
    </div>
  )
}
