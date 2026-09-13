import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { auth } from "@/lib/auth"
import { getReportsSnapshot } from "@/modules/reports/queries"
import {
  REPORT_IDS,
  buildReportsCsv,
  buildReportsHtml,
  buildReportsWorkbook,
  reportCsv,
  reportFilename,
  type ReportId,
} from "@/modules/reports/export"
import { htmlToPdf } from "@/lib/pdf"

export async function GET(
  req: Request,
  ctx: { params: Promise<{ workspace: string }> },
) {
  const { workspace: slug } = await ctx.params
  const url = new URL(req.url)
  const format = url.searchParams.get("format") ?? "xlsx"
  const report = (url.searchParams.get("report") ?? "all") as ReportId
  const projectId = url.searchParams.get("projectId") ?? undefined

  if (!["xlsx", "csv", "pdf"].includes(format)) {
    return NextResponse.json({ error: "Invalid format. Use xlsx, csv or pdf." }, { status: 400 })
  }
  if (!REPORT_IDS.includes(report)) {
    return NextResponse.json(
      { error: `Invalid report. Use one of: ${REPORT_IDS.join(", ")}` },
      { status: 400 },
    )
  }

  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  const ws = await db.workspace.findUnique({ where: { slug } })
  if (!ws) return NextResponse.json({ error: "Workspace not found" }, { status: 404 })
  const membership = await db.workspaceMember.findUnique({
    where: { workspaceId_userId: { workspaceId: ws.id, userId: session.user.id } },
  })
  if (!membership) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const snapshot = await getReportsSnapshot(ws.id, {
    projectId,
    role: membership.role as never,
  })

  if (format === "pdf") {
    const html = buildReportsHtml({
      ...snapshot,
      workspaceName: ws.name,
      generatedAt: new Date().toLocaleString("en-IN"),
    })
    // buildReportsHtml appends window.print(); strip it for headless PDF.
    const pdf = await htmlToPdf(html.replace("<script>window.print()</script>", ""))
    return new Response(new Uint8Array(pdf), {
      headers: {
        "content-type": "application/pdf",
        "content-disposition": `attachment; filename="reports-${slug}.pdf"`,
        "content-length": String(pdf.length),
      },
    })
  }

  if (format === "xlsx") {
    // One workbook, one sheet per report — the full pack in a single file.
    const buf = buildReportsWorkbook(snapshot)
    return new Response(new Uint8Array(buf), {
      headers: {
        "content-type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "content-disposition": `attachment; filename="reports-${slug}.xlsx"`,
        "content-length": String(buf.length),
      },
    })
  }

  const filename = reportFilename(report, "csv", slug)
  const csv = report === "all" ? buildReportsCsv(snapshot) : reportCsv(report, snapshot)
  return new Response(`\uFEFF${csv}`, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${filename}"`,
    },
  })
}
