import type { Metadata } from "next"
import Link from "next/link"

import { SignupForm } from "@/components/auth/signup-form"
import { pageMetadata } from "@/components/landing/site-config"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

// Resolved from content/marketing.ts like every other indexable page — the
// spec says /signup is indexable (priority 0.8), and the previous hand-written
// block contradicted it with index:false and no keyword focus.
export const metadata: Metadata = pageMetadata({ path: "/signup" })

export default function SignupPage() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Create your account</CardTitle>
        <CardDescription>
          We&apos;ll set up a workspace for you right away.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        <SignupForm />
        <p className="text-center text-sm text-muted-foreground">
          Already have an account?{" "}
          <Link
            href="/login"
            className="tap-target font-medium text-foreground underline-offset-4 hover:underline"
          >
            Sign in
          </Link>
        </p>
      </CardContent>
    </Card>
  )
}
