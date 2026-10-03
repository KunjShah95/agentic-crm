import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { processLead } from "@/modules/leadIngest/worker"
import { hitRateLimit, getClientIp } from "@/modules/web-contact/rate-limit"

/**
 * Public enquiry endpoint for the project micro-site form.
 *
 * A browser form cannot carry a shared secret, so this path is protected
 * differently from `/api/webhooks/leads/*`: strict per-IP and per-project rate
 * limits plus a honeypot field, rather than a credential. Those bound the
 * damage a third party can do (junk leads, DB growth, WhatsApp sends) without
 * being bypassable by simply varying a phone number, which is what defeated
 * the existing dedupe key.
 *
 * Passing those gates is what marks the submission `trusted` downstream.
 */
export async function POST(req: Request) {
  const ct = req.headers.get("content-type") ?? ""
  const isForm = ct.includes("form")
  let data: Record<string, string> = {}
  if (isForm) {
    const fd = await req.formData()
    for (const [k, v] of fd.entries()) data[k] = String(v)
  } else {
    try { data = await req.json() } catch { data = {} }
  }
  const slug = data.workspaceSlug ?? data.workspace ?? ""
  const projectId = data.projectId ?? ""
  if (!slug || !projectId) return NextResponse.json({ error: "Missing workspaceSlug/projectId" }, { status: 400 })

  const back = () =>
    NextResponse.redirect(
      new URL(`/sites/${slug}/${projectId}?err=1&lang=${data.locale ?? "en"}`, req.url),
      303
    )

  // Honeypot: a field no human sees. Bots that fill every input get dropped
  // with a success response, so they get no signal that they were caught.
  if ((data.company ?? "").trim()) {
    console.warn("[sites/enquiry] honeypot triggered")
    if (isForm) {
      return NextResponse.redirect(
        new URL(`/sites/${slug}/${projectId}?ok=1&lang=${data.locale ?? "en"}`, req.url),
        303
      )
    }
    return NextResponse.json({ received: true }, { status: 200 })
  }

  // A lead with no way to contact them is not a lead. Rejecting it keeps junk
  // out of the pipeline instead of scoring it.
  const phone = (data.phone ?? "").trim()
  const email = (data.email ?? "").trim()
  if (!phone && !email) {
    return isForm ? back() : NextResponse.json({ error: "Phone or email required" }, { status: 400 })
  }

  const ipLimit = await hitRateLimit(`site-enquiry:ip:${getClientIp(req.headers)}`, {
    max: 5,
    windowMs: 10 * 60_000,
  })
  if (!ipLimit.ok) {
    if (isForm) return back()
    return NextResponse.json(
      { error: "Too many enquiries from this network. Please try later." },
      { status: 429, headers: { "retry-after": String(ipLimit.retryAfterSec) } }
    )
  }

  const ws = await db.workspace.findUnique({ where: { slug }, select: { id: true, slug: true } })
  if (!ws) return NextResponse.json({ error: "Workspace not found" }, { status: 404 })
  const project = await db.project.findFirst({ where: { id: projectId, workspaceId: ws.id } })
  if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 })

  // Per-project daily ceiling. Not IP-derived, so rotating IPs cannot evade it.
  const projectLimit = await hitRateLimit(`site-enquiry:project:${project.id}`, {
    max: 200,
    windowMs: 24 * 60 * 60_000,
  })
  if (!projectLimit.ok) {
    console.warn(`[sites/enquiry] daily project cap hit for ${project.id}`)
    if (isForm) return back()
    return NextResponse.json(
      { error: "Enquiry capacity reached" },
      { status: 429, headers: { "retry-after": String(projectLimit.retryAfterSec) } }
    )
  }

  try {
    const payload = {
      name: data.name ?? "Website Lead",
      phone,
      email,
      bhk: data.bhk ?? data.config ?? "",
      locality: project.name,
      projectId,
      locale: data.locale ?? "en",
    }
    const res = await processLead({
      workspaceId: ws.id,
      source: "website",
      payload,
      // Cleared the honeypot and came in under the limits.
      trusted: true,
    })
    if (isForm) {
      return NextResponse.redirect(new URL(`/sites/${ws.slug}/${projectId}?ok=1&lang=${data.locale ?? "en"}`, req.url), 303)
    }
    return NextResponse.json({ received: true, ...res }, { status: 200 })
  } catch (e) {
    console.error("[sites/enquiry] error", e)
    return NextResponse.json({ received: true, queued: false }, { status: 200 })
  }
}