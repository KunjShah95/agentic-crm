import NextAuth from "next-auth"
import Credentials from "next-auth/providers/credentials"
import Google from "next-auth/providers/google"
import bcrypt from "bcryptjs"
import { z } from "zod"

import { db } from "@/lib/db"

async function loadMemberships(userId: string) {
  const memberships = await db.workspaceMember.findMany({
    where: { userId },
    orderBy: { createdAt: "asc" },
    include: {
      workspace: { select: { id: true, slug: true, name: true } },
    },
  })
  return memberships.map((m) => ({
    id: m.workspaceId,
    slug: m.workspace.slug,
    name: m.workspace.name,
    role: m.role,
  }))
}

type TokenExtra = {
  id?: string
  avatarUrl?: string | null
  activeWorkspaceId?: string | null
  workspaces?: { id: string; slug: string; name: string; role: string }[]
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: "jwt", maxAge: 30 * 24 * 60 * 60 },
  pages: {
    signIn: "/login",
  },
  trustHost: true,
  providers: [
    Credentials({
      name: "Email & password",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const parsed = z
          .object({ email: z.string().email(), password: z.string().min(1) })
          .safeParse(credentials)
        if (!parsed.success) return null

        const user = await db.user.findUnique({
          where: { email: parsed.data.email },
        })
        if (!user?.passwordHash) return null

        const valid = await bcrypt.compare(parsed.data.password, user.passwordHash)
        if (!valid) return null

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          image: user.avatarUrl,
        }
      },
    }),
    // Dormant until GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET are set in .env
    ...(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
      ? [
          Google({
            clientId: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
          }),
        ]
      : []),
  ],
  callbacks: {
    async jwt({ token, user, trigger, session }) {
      const t = token as unknown as TokenExtra

      if (user?.id) {
        t.id = user.id
        t.avatarUrl = user.image ?? null
        t.workspaces = await loadMemberships(user.id)
        t.activeWorkspaceId = t.workspaces[0]?.id ?? null
      }

      // Workspace switch / post-invite refresh from the client (useSession().update)
      if (trigger === "update") {
        t.workspaces = await loadMemberships(t.id ?? "")
        const update = session as { activeWorkspaceId?: string | null } | undefined
        if (update?.activeWorkspaceId) {
          t.activeWorkspaceId = update.activeWorkspaceId
        } else {
          t.activeWorkspaceId = t.workspaces[0]?.id ?? null
        }
      }

      return token
    },
    async session({ session, token }) {
      const s = session as {
        user?: { id?: string; image?: string | null }
        activeWorkspaceId?: string | null
        workspaces?: { id: string; slug: string; name: string; role: string }[]
      }
      const t = token as unknown as TokenExtra

      if (s.user) {
        s.user.id = t.id ?? ""
        s.user.image = t.avatarUrl ?? null
      }
      s.activeWorkspaceId = t.activeWorkspaceId ?? null
      s.workspaces = t.workspaces ?? []
      return session
    },
  },
})
