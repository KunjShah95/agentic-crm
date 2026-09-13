import { redirect } from "next/navigation"

export default async function WorkspaceIndex({ params }: { params: Promise<{ workspace: string }> }) {
  const { workspace: slug } = await params
  redirect(`/${slug}/dashboard`)
}
