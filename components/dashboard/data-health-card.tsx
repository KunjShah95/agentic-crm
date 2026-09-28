import { db } from "@/lib/db"
import { cn } from "@/lib/utils"
import {
  completenessBarColor,
  completenessTextColor,
  type CompletenessTone,
} from "@/lib/completeness"
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
        {/*
          The one progress bar in the app, shared by both rows. It used to be
          hand-rolled twice with `transition-all` — which animates width on every
          repaint, so the bar visibly re-eased whenever an unrelated card
          re-rendered. Naming the property (`transform`) and driving the fill
          with a scale transform instead of a width percentage means the
          compositor handles it and no layout is invalidated at all.
        */}
        <ScoreBar
          label="Contacts"
          sampleSize={contacts.length}
          score={avgContactScore}
          color={contactColor}
        />
        <ScoreBar
          label="Deals"
          sampleSize={deals.length}
          score={avgDealScore}
          color={dealColor}
        />
      </CardContent>
    </Card>
  )
}

/**
 * One labelled completeness bar.
 *
 * The track is 6px tall, which is the smallest height that still reads as a
 * filled proportion at a glance without becoming a chart. The fill is
 * `transform-origin: left` and scaled, not sized — width changes force layout
 * on every animated frame, scale does not.
 */
function ScoreBar({
  label,
  sampleSize,
  score,
  color,
}: {
  label: string
  sampleSize: number
  score: number
  color: CompletenessTone
}) {
  const pct = Math.max(0, Math.min(100, score))
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <span className="truncate text-xs text-muted-foreground">
          {label}
          <span className="text-muted-foreground/70"> ({sampleSize} sampled)</span>
        </span>
        <span
          className={cn(
            "shrink-0 text-xs font-semibold tabular-nums",
            completenessTextColor(color)
          )}
        >
          {pct}%
        </span>
      </div>
      <div
        role="meter"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`${label} record completeness`}
        className="h-1.5 w-full overflow-hidden rounded-full bg-muted"
      >
        <div
          className={cn(
            "h-full origin-left rounded-full transition-transform duration-500 [transition-timing-function:var(--ease-out)] motion-reduce:transition-none",
            completenessBarColor(color)
          )}
          style={{ transform: `scaleX(${pct / 100})` }}
        />
      </div>
    </div>
  )
}
