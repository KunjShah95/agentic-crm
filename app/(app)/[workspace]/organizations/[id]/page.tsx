import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import {
  ArrowLeft,
  Building2,
  Globe,
  Link2,
  Sparkles,
  Users,
} from "lucide-react"

import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { fullName, formatMoney } from "@/lib/format"
import {
  getLinkableContacts,
  getOrganizationDetail,
} from "@/modules/organizations/queries"
import { OrgDetailActions } from "@/components/organizations/org-detail-actions"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
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
import { Button } from "@/components/ui/button"
import { LinkContactsButton } from "@/components/organizations/link-contacts-button"

export const metadata: Metadata = { title: "Organization" }

export default async function OrganizationDetailPage({
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

  const org = await getOrganizationDetail(workspace.id, id)
  if (!org) notFound()

  const linkable = await getLinkableContacts(workspace.id, org.domain)
  const totalDealValue = org.deals.reduce((sum, d) => sum + (d.value ?? 0), 0)

  return (
    <div className="flex flex-col gap-5">
      <Button
        variant="ghost"
        size="sm"
        className="w-fit -ml-2 text-muted-foreground"
        render={<Link href={`/${slug}/organizations`} />}
      >
        <ArrowLeft data-icon="inline-start" />
        Organizations
      </Button>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <span className="flex size-14 items-center justify-center rounded-xl bg-muted">
            <Building2 className="size-7 text-muted-foreground" />
          </span>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">{org.name}</h1>
            <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
              {org.domain && (
                <span className="inline-flex items-center gap-1">
                  <Globe className="size-3.5" />
                  {org.domain}
                </span>
              )}
              {org.industry && <span>{org.industry}</span>}
              {org.size && <span>{org.size} employees</span>}
              {org.website && (
                <a
                  href={org.website}
                  target="_blank"
                  rel="noreferrer"
                  className="text-primary hover:underline"
                >
                  {org.website.replace(/^https?:\/\//, "")}
                </a>
              )}
            </p>
          </div>
        </div>
        <OrgDetailActions
          workspaceId={workspace.id}
          workspaceSlug={slug}
          org={{
            id: org.id,
            name: org.name,
            domain: org.domain,
            industry: org.industry,
            size: org.size,
            website: org.website,
          }}
          role={membership.role}
        />
      </div>

      {/* Auto-link suggestion */}
      {linkable.length > 0 && (
        <Card className="border-primary/30 bg-primary/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Sparkles className="size-4 text-primary" />
              Suggested links
            </CardTitle>
            <CardDescription>
              {linkable.length} contact{linkable.length !== 1 ? "s" : ""} with a{" "}
              {org.domain} email {linkable.length !== 1 ? "aren't" : "isn't"} linked
              yet.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {linkable.map((contact) => (
              <LinkContactsButton
                key={contact.id}
                workspaceId={workspace.id}
                orgId={org.id}
                contact={{
                  id: contact.id,
                  name: fullName(contact.firstName, contact.lastName),
                  email: contact.email,
                }}
              />
            ))}
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <div className="flex flex-col gap-5">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Summary</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Contacts</span>
                <span className="font-medium">{org.contacts.length}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Deals</span>
                <span className="font-medium">{org.deals.length}</span>
              </div>
              <div className="flex items-center justify-between border-t pt-3">
                <span className="text-muted-foreground">Deal value</span>
                <span className="font-semibold">
                  {formatMoney(totalDealValue)}
                </span>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="flex flex-col gap-5 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Users className="size-4" />
                Contacts ({org.contacts.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {org.contacts.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  No contacts linked yet.
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead>Contact</TableHead>
                      <TableHead className="hidden md:table-cell">Email</TableHead>
                      <TableHead className="text-right">Owner</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {org.contacts.map((contact) => (
                      <TableRow key={contact.id}>
                        <TableCell>
                          <div className="flex items-center gap-2.5">
                            <Avatar className="size-7">
                              <AvatarFallback className="text-[10px]">
                                {fullName(contact.firstName, contact.lastName)
                                  .slice(0, 2)
                                  .toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            <Link
                              href={`/${slug}/contacts/${contact.id}`}
                              className="font-medium hover:underline"
                            >
                              {fullName(contact.firstName, contact.lastName)}
                            </Link>
                          </div>
                        </TableCell>
                        <TableCell className="hidden text-sm text-muted-foreground md:table-cell">
                          {contact.email ?? "—"}
                        </TableCell>
                        <TableCell className="text-right text-sm text-muted-foreground">
                          {contact.owner?.name ?? "—"}
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
              <CardTitle className="flex items-center gap-2 text-base">
                <Link2 className="size-4" />
                Deals ({org.deals.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {org.deals.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  No deals for this company yet.
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
                    {org.deals.map((deal) => (
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
                            style={{
                              borderColor: deal.stage.color,
                              color: deal.stage.color,
                            }}
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
        </div>
      </div>
    </div>
  )
}
