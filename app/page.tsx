import { auth } from "@/lib/auth"
import { LandingClient } from "@/components/landing/landing-client"

export default async function Home() {
  const session = await auth()
  const workspaceSlug = session?.workspaces?.[0]?.slug ?? null
  const isAuthed = !!session

  return <LandingClient workspaceSlug={workspaceSlug} isAuthed={isAuthed} />
}
