import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { listBookings, listBookableUnits, listPaymentPlans } from "@/modules/booking/queries"
import { resolveBrokerId } from "@/modules/brokers/queries"
import { BookingBoard } from "@/components/booking/booking-board"
import { PageHeader } from "@/components/shell/page-header"

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
      <PageHeader
        title="Bookings"
        description={<>{deals.length} deal{deals.length !== 1 ? "s" : ""} in the booking pipeline · track from hold to payment collection</>}
      />
      <BookingBoard workspaceId={workspace.id} deals={deals} units={units} plans={plans} />
    </div>
  )
}
