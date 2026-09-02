import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { processLead } from "@/modules/leadIngest/worker"

export async function POST(req: Request) {
  const ct = req.headers.get("content-type") ?? ""
  let data: Record<string, string> = {}
  if (ct.includes("application/x-www-form-urlencoded") || ct.includes("multipart/form-data")) {
    const fd = await req.formData()
    for (const [k, v] of fd.entries()) data[k] = String(v)
  } else {
    try { data = await req.json() } catch { data = {} }
  }
  const slug = data.workspaceSlug ?? data.workspace ?? ""
  const projectId = data.projectId ?? ""
  if (!slug || !projectId) return NextResponse.json({ error: "Missing workspaceSlug/projectId" }, { status: 400 })
  const ws = await db.workspace.findUnique({ where: { slug }, select: { id: true, slug: true } })
  if (!ws) return NextResponse.json({ error: "Workspace not found" }, { status: 404 })
  const project = await db.project.findFirst({ where: { id: projectId, workspaceId: ws.id } })
  if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 })

  try {
    const payload = {
      name: data.name ?? "Website Lead",
      phone: data.phone ?? "",
      email: data.email ?? "",
      bhk: data.bhk ?? data.config ?? "",
      locality: project.name,
      projectId,
      locale: data.locale ?? "en",
    }
    const res = await processLead({ workspaceId: ws.id, source: "website", payload })
    // if form submit, redirect back to public site with ?ok=1
    if (ct.includes("form")) {
      return NextResponse.redirect(new URL(`/sites/${ws.slug}/${projectId}?ok=1&lang=${data.locale ?? "en"}`, req.url), 303)
    }
    return NextResponse.json({ received: true, ...res }, { status: 200 })
  } catch (e) {
    console.error("[sites/enquiry] error", e)
    return NextResponse.json({ received: true, queued: false }, { status: 200 })
  }
}
