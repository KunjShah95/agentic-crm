import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { listBookings, listBookableUnits, listPaymentPlans } from "@/modules/booking/queries"
import { resolveBrokerId } from "@/modules/brokers/queries"
import { BookingBoard } from "@/components/booking/booking-board"

export const metadata: Metadata = { title: "Bookings" }

export default async function BookingsPage({ params }: { params: Promise<{ workspace: string }> }) {
  const { workspace: slug } = await params
  const session = await auth()
  const workspace = await db.workspace.findUnique({ where: { slug } })
  if (!workspace) notFound()

  const membership = session?.user?.id
    ? await db.workspaceMember.findUnique({ where: { workspaceId_userId: { workspaceId: workspace.id, userId: session.user.id } } })
    : null
  if (!membership) notFound()

  const brokerId = membership.role === "BROKER" ? await resolveBrokerId(workspace.id, session!.user!.id) : null
  const [deals, units, plans] = await Promise.all([
    listBookings({ workspaceId: workspace.id, role: membership.role, brokerId }),
    listBookableUnits(workspace.id),
    listPaymentPlans(workspace.id),
  ])

  return (
    <div className="space-y-6">
      <div className="rounded-[20px] border bg-card p-5 md:p-6 relative overflow-hidden">
        <div aria-hidden className="pointer-events-none absolute inset-0">
          <div className="absolute -top-16 -right-16 h-48 w-64 rounded-full bg-gradient-to-br from-amber-500/10 via-violet-500/10 to-blue-500/10 blur-2xl" />
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-amber-500/20 to-transparent" />
        </div>
        <div className="relative">
          <h1 className="text-[22px] font-semibold tracking-tight">Bookings</h1>
          <p className="mt-1 text-sm text-muted-foreground">Hold → Booking → CLP milestones → demand letter. {deals.length} deals across the RE pipeline · no Excel.</p>
        </div>
      </div>
      <BookingBoard workspaceId={workspace.id} deals={deals} units={units} plans={plans} />
    </div>
  )
}
