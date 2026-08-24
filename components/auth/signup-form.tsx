"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { LoaderCircle } from "lucide-react"

import { signupAction } from "@/lib/actions/auth"
import { Button } from "@/components/ui/button"
import {
  Field,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Alert } from "@/components/ui/alert"

export function SignupForm({
  inviteToken,
  defaultWorkspaceName,
}: {
  inviteToken?: string
  defaultWorkspaceName?: string
}) {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    const form = new FormData(event.currentTarget)
    startTransition(async () => {
      const result = await signupAction({
        name: form.get("name"),
        email: form.get("email"),
        password: form.get("password"),
        workspaceName: form.get("workspaceName") ?? defaultWorkspaceName,
        inviteToken: inviteToken ?? undefined,
      })
      if (result.error) {
        setError(result.error.message)
        return
      }
      router.push("/")
      router.refresh()
    })
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-5">
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="name">Full name</FieldLabel>
          <Input
            id="name"
            name="name"
            placeholder="Ada Lovelace"
            autoComplete="name"
            required
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="email">Email</FieldLabel>
          <Input
            id="email"
            name="email"
            type="email"
            placeholder="you@company.com"
            autoComplete="email"
            required
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="password">Password</FieldLabel>
          <Input
            id="password"
            name="password"
            type="password"
            placeholder="At least 8 characters"
            autoComplete="new-password"
            minLength={8}
            required
          />
        </Field>
        {!inviteToken && (
          <Field>
            <FieldLabel htmlFor="workspaceName">Workspace name</FieldLabel>
            <Input
              id="workspaceName"
              name="workspaceName"
              placeholder="Acme Inc."
              autoComplete="organization"
              required
            />
          </Field>
        )}
      </FieldGroup>

      {error && <Alert variant="destructive">{error}</Alert>}

      <Button type="submit" disabled={isPending} className="w-full">
        {isPending && (
          <LoaderCircle data-icon="inline-start" className="animate-spin" />
        )}
        {isPending
          ? "Creating your workspace…"
          : inviteToken
            ? "Create account & join workspace"
            : "Create account"}
      </Button>
    </form>
  )
}
