"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { LoaderCircle, Save } from "lucide-react"

import { updateWorkspaceSettingsAction } from "@/lib/actions/settings"
import { slugify } from "@/lib/format"
import { Button } from "@/components/ui/button"
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"

export function WorkspaceSettingsForm({
  workspaceId,
  workspaceSlug,
  initial,
}: {
  workspaceId: string
  workspaceSlug: string
  initial: { name: string; slug: string }
}) {
  const router = useRouter()
  const [name, setName] = useState(initial.name)
  const [slug, setSlug] = useState(initial.slug)
  const [isPending, startTransition] = useTransition()

  function onNameChange(value: string) {
    setName(value)
    // Auto-suggest a slug unless the user has edited it themselves
    if (slug === slugify(initial.name)) {
      setSlug(slugify(value))
    }
  }

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    startTransition(async () => {
      const result = await updateWorkspaceSettingsAction(workspaceId, {
        name: name.trim(),
        slug: slug.trim(),
      })
      if (result.error) {
        toast.error(result.error.message)
        return
      }
      toast.success("Workspace updated")
      if (slug.trim() !== workspaceSlug) {
        router.push(`/${slug.trim()}/settings`)
      } else {
        router.refresh()
      }
    })
  }

  return (
    <form onSubmit={onSubmit} className="flex max-w-md flex-col gap-4">
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="ws-name">Workspace name</FieldLabel>
          <Input
            id="ws-name"
            value={name}
            onChange={(e) => onNameChange(e.target.value)}
            required
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="ws-slug">URL slug</FieldLabel>
          <Input
            id="ws-slug"
            value={slug}
            onChange={(e) => setSlug(slugify(e.target.value))}
            placeholder="my-workspace"
            required
          />
          <FieldDescription>
            Your workspace lives at /{slug || "…"}
          </FieldDescription>
        </Field>
      </FieldGroup>
      <div>
        <Button type="submit" disabled={isPending}>
          {isPending ? (
            <LoaderCircle data-icon="inline-start" className="animate-spin" />
          ) : (
            <Save data-icon="inline-start" />
          )}
          Save changes
        </Button>
      </div>
    </form>
  )
}
