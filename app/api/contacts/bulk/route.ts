import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { AppError } from "@/lib/errors"
import { requireWorkspaceMember } from "@/lib/permissions"

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = await req.json()
  const { workspaceId, contacts } = body

  if (!workspaceId || !Array.isArray(contacts)) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 })
  }

  try {
    await requireWorkspaceMember(workspaceId, session.user.id)
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const created = await db.contact.createMany({
    data: contacts.map((c: Record<string, string>) => ({
      workspaceId,
      createdBy: session.user.id,
      firstName: c.firstName || "",
      lastName: c.lastName || "",
      email: c.email || null,
      phone: c.phone || null,
      jobTitle: c.jobTitle || null,
      linkedinUrl: c.linkedinUrl || null,
    })),
    skipDuplicates: true,
  })

  return NextResponse.json({ created: created.count })
}
