"use client"

import { useState, useTransition } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { ArrowRight, Loader2 } from "lucide-react"

import { submitPublicContactAction } from "@/lib/actions/contacts"

type FieldErrors = Partial<Record<"name" | "email" | "company" | "message", string>>

function validate(values: {
  name: string
  email: string
  company: string
  message: string
}): FieldErrors {
  const errors: FieldErrors = {}
  if (!values.name.trim() || values.name.trim().length < 2) {
    errors.name = "Please enter your full name."
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email.trim())) {
    errors.email = "Enter a valid work email."
  }
  if (!values.company.trim()) {
    errors.company = "Tell us your builder / firm name."
  }
  if (!values.message.trim() || values.message.trim().length < 10) {
    errors.message = "Add a short note (at least 10 characters)."
  }
  return errors
}

export function ContactForm() {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [errors, setErrors] = useState<FieldErrors>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [values, setValues] = useState({
    name: "",
    email: "",
    company: "",
    phone: "",
    message: "",
    website: "", // honeypot — hidden field, must stay empty
  })

  const onChange = (field: keyof typeof values) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setValues((v) => ({ ...v, [field]: e.target.value }))
    if (errors[field as keyof FieldErrors]) {
      setErrors((prev) => {
        const next = { ...prev }
        delete next[field as keyof FieldErrors]
        return next
      })
    }
  }

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setFormError(null)
    const nextErrors = validate(values)
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) return

    startTransition(async () => {
      try {
        const res = await submitPublicContactAction(values)
        if (res.error) {
          setFormError(
            res.error.code === "RATE_LIMITED"
              ? "You've sent several messages in a short time. Please wait a minute and try again, or email hello@estate360.in."
              : res.error.message
          )
          return
        }
        sessionStorage.setItem(
          "loop-contact-lead",
          JSON.stringify({ ...values, submittedAt: new Date().toISOString() })
        )
        router.push("/thank-you")
      } catch {
        setFormError("Something went wrong. Please try again or email hello@estate360.in.")
      }
    })
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          id="name"
          label="Full name"
          error={errors.name}
          required
        >
          <Input
            id="name"
            name="name"
            autoComplete="name"
            value={values.name}
            onChange={onChange("name")}
            aria-invalid={!!errors.name}
            aria-describedby={errors.name ? "name-error" : undefined}
            className="h-10"
            placeholder="Hemal Shah"
            disabled={pending}
          />
        </Field>
        <Field id="email" label="Work email" error={errors.email} required>
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            value={values.email}
            onChange={onChange("email")}
            aria-invalid={!!errors.email}
            aria-describedby={errors.email ? "email-error" : undefined}
            className="h-10"
            placeholder="hemal@shilp.co.in"
            disabled={pending}
          />
        </Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="company" label="Company / project" error={errors.company} required>
          <Input
            id="company"
            name="company"
            value={values.company}
            onChange={onChange("company")}
            aria-invalid={!!errors.company}
            aria-describedby={errors.company ? "company-error" : undefined}
            className="h-10"
            placeholder="Shilp Infra"
            disabled={pending}
          />
        </Field>
        <Field id="phone" label="Phone (optional)">
          <Input
            id="phone"
            name="phone"
            type="tel"
            autoComplete="tel"
            value={values.phone}
            onChange={onChange("phone")}
            className="h-10"
            placeholder="+91 98xxx xxxxx"
            disabled={pending}
          />
        </Field>
      </div>
      <Field id="message" label="How can we help?" error={errors.message} required>
        <Textarea
          id="message"
          name="message"
          rows={5}
          value={values.message}
          onChange={onChange("message")}
          aria-invalid={!!errors.message}
          aria-describedby={errors.message ? "message-error" : undefined}
          placeholder="We run 3 sites on SG Highway and need HOLD→CLP without Excel…"
          disabled={pending}
          className="min-h-[120px] resize-y"
        />
      </Field>

      {formError && (
        <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {formError}
        </p>
      )}

      {/* Honeypot field — visually hidden and ignored by keyboard/touch users */}
      <div aria-hidden className="absolute left-[-9999px] top-auto size-px overflow-hidden" tabIndex={-1}>
        <label htmlFor="website">Leave this field empty</label>
        <input
          id="website"
          name="website"
          type="text"
          tabIndex={-1}
          autoComplete="off"
          value={values.website}
          onChange={onChange("website")}
        />
      </div>

      <Button type="submit" size="lg" className="h-11 w-full gap-2 rounded-full sm:w-auto" disabled={pending}>
        {pending ? (
          <>
            <Loader2 className="size-4 animate-spin" aria-hidden />
            Sending…
          </>
        ) : (
          <>
            Send message <ArrowRight className="size-4" aria-hidden />
          </>
        )}
      </Button>
      <p className="text-xs text-muted-foreground">
        By submitting you agree to our{" "}
        <Link href="/privacy" className="underline underline-offset-2 hover:text-foreground">
          Privacy Policy
        </Link>
        . We reply within one business day.
      </p>
    </form>
  )
}

function Field({
  id,
  label,
  error,
  required,
  children,
}: {
  id: string
  label: string
  error?: string
  required?: boolean
  children: React.ReactNode
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>
        {label}
        {required ? <span className="text-destructive"> *</span> : null}
      </Label>
      {children}
      {error ? (
        <p id={`${id}-error`} role="alert" className="text-[12px] text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  )
}
