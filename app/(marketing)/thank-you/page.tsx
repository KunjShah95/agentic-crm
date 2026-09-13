import type { Metadata } from "next"
import Link from "next/link"
import { auth } from "@/lib/auth"
import { MarketingChrome } from "@/components/landing/marketing-chrome"
import { PageHero } from "@/components/landing/page-hero"
import { pageMetadata, SITE } from "@/components/landing/site-config"
import { Button } from "@/components/ui/button"
import { CheckCircle2, ArrowRight } from "lucide-react"

export const metadata: Metadata = pageMetadata({
  title: "Thank you",
  description: "Thanks for contacting Estate360. Our Ahmedabad team will reply within one business day.",
  path: "/thank-you",
  robots: { index: false, follow: false },
})

export default async function ThankYouPage() {
  const session = await auth()
  const workspaceSlug = session?.workspaces?.[0]?.slug ?? null
  const isAuthed = !!session
  const { contact } = SITE

  return (
    <MarketingChrome isAuthed={isAuthed} workspaceSlug={workspaceSlug}>
      <PageHero
        eyebrow="MESSAGE RECEIVED"
        title="Thank you — we'll close this loop."
        description={`Our team at Mondeal Heights reads every note. Expect a reply at your email within one business day (${contact.hours}).`}
      />
      <section className="mx-auto max-w-[560px] px-6 pb-20 text-center lg:px-8">
        <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-400">
          <CheckCircle2 className="size-7" aria-hidden />
        </div>
        <ul className="mt-8 space-y-3 text-left text-sm leading-6 text-muted-foreground">
          <li className="rounded-xl border bg-card px-4 py-3">
            <span className="font-medium text-foreground">Meanwhile:</span> try the interactive demo on the{" "}
            <Link href="/" className="underline underline-offset-2 hover:text-foreground">
              home page
            </Link>{" "}
            — drag a deal across Lead → Closing.
          </li>
          <li className="rounded-xl border bg-card px-4 py-3">
            <span className="font-medium text-foreground">Prefer self-serve?</span> Start your 14-day free trial.
          </li>
          <li className="rounded-xl border bg-card px-4 py-3">
            <span className="font-medium text-foreground">Urgent?</span> Call{" "}
            <a href={`tel:${contact.phone.replace(/\s/g, "")}`} className="underline underline-offset-2">
              {contact.phone}
            </a>{" "}
            or email {contact.email}.
          </li>
        </ul>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Button className="gap-1.5 rounded-full" render={<Link href="/signup" />}>
            Start free trial <ArrowRight className="size-4" aria-hidden />
          </Button>
          <Button variant="outline" className="rounded-full" render={<Link href="/product" />}>
            Explore product
          </Button>
        </div>
      </section>
    </MarketingChrome>
  )
}
