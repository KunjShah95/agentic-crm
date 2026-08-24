type WorkspaceLite = {
  id: string
  slug: string
  name: string
  role: string
}

declare module "@auth/core/types" {
  interface Session {
    // Re-declared from DefaultSession — augmentation drops the extends heritage
    user: {
      id: string
      name: string | null
      email: string | null
      image?: string | null
    }
    expires: string
    activeWorkspaceId: string | null
    workspaces: WorkspaceLite[]
  }
}

declare module "@auth/core/jwt" {
  interface JWT {
    id?: string
    avatarUrl?: string | null
    activeWorkspaceId?: string | null
    workspaces?: WorkspaceLite[]
  }
}
