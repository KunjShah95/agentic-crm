import { notFound } from "next/navigation"
import { getPublicProject } from "@/modules/sites/queries"
import { t, type Locale } from "@/lib/i18n"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Building2 } from "lucide-react"

export default async function PublicSitePage({
  params,
  searchParams,
}: {
  params: Promise<{ workspace: string; project: string }>
  searchParams: Promise<{ lang?: string; ok?: string }>
}) {
  const { workspace, project } = await params
  const { lang, ok } = await searchParams
  const locale = (lang === "gu" || lang === "hi" ? lang : "en") as Locale
  const data = await getPublicProject(workspace, project)
  if (!data) notFound()
  const { project: proj, units, workspace: ws } = data

  return (
    <div className="mx-auto max-w-5xl p-6 space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2"><Building2 className="size-6" /> {proj.name}</h1>
          <p className="text-sm text-muted-foreground">{proj.reraNo ?? "RERA TBD"} · {proj.city} · {units.length} {t(locale, "sites_title")}</p>
        </div>
        <div className="flex gap-1 text-xs">
          <a href={`?lang=en`} className={`rounded-full border px-2 py-1 ${locale==="en"?"bg-foreground text-background":""}`}>EN</a>
          <a href={`?lang=gu`} className={`rounded-full border px-2 py-1 ${locale==="gu"?"bg-foreground text-background":""}`}>GU</a>
          <a href={`?lang=hi`} className={`rounded-full border px-2 py-1 ${locale==="hi"?"bg-foreground text-background":""}`}>HI</a>
        </div>
      </div>

      {ok ? <div className="rounded-xl border bg-emerald-50 px-4 py-3 text-sm text-emerald-900">{t(locale, "enquiry_ok")}</div> : null}

      <div className="grid md:grid-cols-3 gap-3">
        {units.map((u) => (
          <Card key={u.id}>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">{u.unitNo} <Badge variant="secondary" className="ml-1">{u.config}</Badge></CardTitle>
              <div className="text-xs text-muted-foreground">{u.carpetArea ? `${u.carpetArea} sq ft` : ""} · {u.status}</div>
            </CardHeader>
            <CardContent><div className="font-mono text-sm">{u.price ? `₹${u.price.toLocaleString("en-IN")}` : "Price on request"}</div></CardContent>
          </Card>
        ))}
        {units.length===0 ? <p className="text-sm text-muted-foreground">No available units.</p> : null}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Enquire</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={`/api/sites/enquiry`} method="POST" className="space-y-3">
            <input type="hidden" name="workspaceSlug" value={ws.slug} />
            <input type="hidden" name="projectId" value={proj.id} />
            <input type="hidden" name="locale" value={locale} />
            <div className="grid md:grid-cols-2 gap-3">
              <div className="space-y-1"><Label>Name</Label><Input name="name" required placeholder="Asha Patel" /></div>
              <div className="space-y-1"><Label>Phone</Label><Input name="phone" required placeholder="+91 98..." /></div>
              <div className="space-y-1"><Label>Email</Label><Input name="email" placeholder="asha@example.com" /></div>
              <div className="space-y-1"><Label>BHK</Label><Input name="bhk" placeholder="BHK2" /></div>
            </div>
            <Button type="submit" className="rounded-full">Submit enquiry → scored lead (WEBSITE)</Button>
            <p className="text-xs text-muted-foreground">Source WEBSITE → scored lead, auto-routed, WhatsApp ack in &lt;4 min.</p>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
