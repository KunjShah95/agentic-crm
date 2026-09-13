"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { LoaderCircle } from "lucide-react"

import { loginAction } from "@/lib/actions/auth"
import { Button } from "@/components/ui/button"
import {
  Field,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Alert } from "@/components/ui/alert"

export function LoginForm() {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [isPending, startTransition] = useTransition()

  function fillDemo() {
    setEmail("kkshah2005@gmail.com")
    setPassword("kunj2005")
  }

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    const form = new FormData(event.currentTarget)
    startTransition(async () => {
      const result = await loginAction({
        email: form.get("email"),
        password: form.get("password"),
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
      <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-900 dark:text-amber-200 flex items-center justify-between gap-2">
        <div>
          <p className="font-medium">Demo Credentials Available</p>
          <p className="text-[11px] opacity-85 font-mono">kkshah2005@gmail.com</p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="xs"
          onClick={fillDemo}
          className="border-amber-500/40 text-amber-950 dark:text-amber-100 hover:bg-amber-500/20"
        >
          Auto-fill
        </Button>
      </div>

      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="email">Email address</FieldLabel>
          <Input
            id="email"
            name="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@company.com"
            autoComplete="email"
            required
            className="focus-visible:ring-brand"
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="password">Password</FieldLabel>
          <Input
            id="password"
            name="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            autoComplete="current-password"
            required
            className="focus-visible:ring-brand"
          />
        </Field>
      </FieldGroup>

      {error && (
        <Alert variant="destructive">
          {error}
        </Alert>
      )}

      <Button type="submit" disabled={isPending} className="w-full bg-brand text-brand-foreground hover:bg-brand/90 font-medium">
        {isPending && (
          <LoaderCircle data-icon="inline-start" className="animate-spin" />
        )}
        {isPending ? "Signing in…" : "Sign in to Workspace"}
      </Button>
    </form>
  )
}
