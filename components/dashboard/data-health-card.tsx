import { db } from "@/lib/db"
import { cn } from "@/lib/utils"
import { completenessBarColor, completenessTextColor } from "@/lib/completeness"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

export async function DataHealthCard({ workspaceId }: { workspaceId: string }) {
  const [contacts, deals] = await Promise.all([
    db.contact.findMany({
      where: { workspaceId },
      select: {
        firstName: true,
        email: true,
        phone: true,
        organizationId: true,
        jobTitle: true,
        ownerId: true,
        leadSource: true,
      },
      take: 100,
    }),
    db.deal.findMany({
      where: { workspaceId },
      select: {
        title: true,
        contactId: true,
        value: true,
        stageId: true,
        ownerId: true,
        expectedCloseDate: true,
        dealType: true,
        probability: true,
      },
      take: 100,
    }),
  ])

  function calcContactScore(c: (typeof contacts)[0]) {
    let s = 0
    if (c.firstName?.trim()) s += 10
    if (c.email?.trim()) s += 20
    if (c.phone?.trim()) s += 20
    if (c.organizationId) s += 15
    if (c.jobTitle?.trim()) s += 10
    if (c.ownerId) s += 10
    if (c.leadSource?.trim()) s += 10
    // Tags not queried for performance — count as 5% bonus if other fields are strong
    if (s >= 85) s += 5
    return s
  }

  function calcDealScore(d: (typeof deals)[0]) {
    let s = 0
    if (d.title?.trim()) s += 10
    if (d.contactId) s += 20
    if (d.value && d.value > 0) s += 20
    if (d.stageId) s += 10
    if (d.ownerId) s += 10
    if (d.expectedCloseDate) s += 10
    if (d.dealType?.trim()) s += 10
    if (d.probability != null) s += 10
    return s
  }

  const avgContactScore = contacts.length > 0
    ? Math.round(contacts.reduce((sum, c) => sum + calcContactScore(c), 0) / contacts.length)
    : 0
  const avgDealScore = deals.length > 0
    ? Math.round(deals.reduce((sum, d) => sum + calcDealScore(d), 0) / deals.length)
    : 0

  const contactColor = avgContactScore < 40 ? "red" : avgContactScore < 70 ? "yellow" : "green"
  const dealColor = avgDealScore < 40 ? "red" : avgDealScore < 70 ? "yellow" : "green"

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">Data Health</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs text-muted-foreground">Contacts ({contacts.length} sampled)</span>
            <span className={cn("text-xs font-semibold tabular-nums", completenessTextColor(contactColor))}>
              {avgContactScore}%
            </span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <div
              className={cn("h-full rounded-full transition-all", completenessBarColor(contactColor))}
              style={{ width: `${avgContactScore}%` }}
            />
          </div>
        </div>
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs text-muted-foreground">Deals ({deals.length} sampled)</span>
            <span className={cn("text-xs font-semibold tabular-nums", completenessTextColor(dealColor))}>
              {avgDealScore}%
            </span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <div
              className={cn("h-full rounded-full transition-all", completenessBarColor(dealColor))}
              style={{ width: `${avgDealScore}%` }}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
