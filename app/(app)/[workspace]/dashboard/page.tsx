import { redirect } from "next/navigation"

// Old "Dashboard" route — Today is now the default landing page (#3).
// Keep redirecting so existing bookmarks never 404.
export default async function DashboardRedirect({ params }: { params: Promise<{ workspace: string }> }) {
  const { workspace: slug } = await params
  redirect(`/${slug}/today`)
}