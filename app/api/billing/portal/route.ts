import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { requireWorkspaceMember } from "@/lib/permissions"
import { stripe } from "@/modules/billing/stripe"

export async function POST(req: Request) {
  const session = await auth()
  const userId = (session?.user as unknown as { id?: string } | undefined)?.id
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  let body: Record<string, unknown> = {}
  try {
    body = (await req.json()) as Record<string, unknown>
  } catch {
    body = {}
  }

  const workspaceId = (body.workspaceId ?? body.workspace_id) as string | undefined
  if (!workspaceId) {
    return NextResponse.json({ error: "workspaceId required" }, { status: 400 })
  }

  try {
    await requireWorkspaceMember(workspaceId, userId, "ADMIN")
  } catch (e) {
    const msg = (e as Error).message
    const status = (e as { status?: number }).status ?? 403
    return NextResponse.json({ error: msg }, { status })
  }

  const sub = await db.subscription.findUnique({ where: { workspaceId } })
  if (!sub?.stripeCustomerId) {
    return NextResponse.json({ error: "No subscription found for workspace" }, { status: 400 })
  }

  const workspace = await db.workspace.findUnique({ where: { id: workspaceId }, select: { slug: true } })
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? process.env.AUTH_URL ?? "http://localhost:3000"
  const slugOrId = workspace?.slug ?? workspaceId
  const returnUrl = `${baseUrl}/${slugOrId}/settings/billing`

  try {
    const portal = await stripe.billingPortal.sessions.create({
      customer: sub.stripeCustomerId,
      return_url: returnUrl,
    })
    return NextResponse.json({ url: portal.url })
  } catch (e) {
    const msg = (e as Error).message
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
