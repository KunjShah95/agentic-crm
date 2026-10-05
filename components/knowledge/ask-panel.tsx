"use client"

import { useActionState } from "react"
import { toast } from "sonner"
import {
  askKnowledgeAction,
  rateKnowledgeAnswerAction,
  type KnowledgeAnswer,
} from "@/lib/actions/knowledge"
import type { Result } from "@/lib/actions"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Spinner } from "@/components/ui/spinner"
import {
  BookOpen,
  ThumbsDown,
  ThumbsUp,
  TriangleAlert,
  FileQuestion,
} from "lucide-react"

/**
 * Ask the workspace knowledge base.
 *
 * The answer is rendered as a claim plus its sources rather than as prose, because
 * the engine's value is that it can refuse: `answerQuery` returns `refused: true`
 * with no citations when the confidence gate fails, and a faithfulness warning
 * listing claims it could not support. All three outcomes are shown distinctly.
 * Collapsing them into one grey text block would hide the most useful thing the
 * pipeline does, which is decline.
 */

const EXAMPLES = [
  "What is the refund window on a booking?",
  "Which RERA disclosures must go on the booking form?",
  "How long do we hold a unit on hold?",
]

function ConfidenceBadge({ answer }: { answer: KnowledgeAnswer }) {
  if (answer.refused) {
    return (
      <Badge variant="outline" className="gap-1">
        <FileQuestion className="size-3" /> Not confident enough to answer
      </Badge>
    )
  }
  if (answer.warning) {
    return (
      <Badge variant="destructive" className="gap-1">
        <TriangleAlert className="size-3" /> Unverified claims
      </Badge>
    )
  }
  return <Badge variant="secondary">Grounded in {answer.citations.length} sources</Badge>
}

function Citations({ answer }: { answer: KnowledgeAnswer }) {
  if (answer.citations.length === 0) return null

  return (
    <div className="space-y-2">
      <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        Sources
      </h3>
      <ol className="space-y-2">
        {answer.citations.map((c) => (
          <li
            key={`${c.source}-${c.documentId}`}
            className="rounded-md border bg-muted/30 p-3 text-sm"
          >
            <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
              <span className="font-medium">{c.title}</span>
              {c.department ? (
                <Badge variant="outline" className="text-[11px]">
                  {c.department}
                </Badge>
              ) : null}
              {/* The per-citation score, not the top-line one. A high average over
                  three sources and one weak source are different answers, and only
                  the per-citation number tells you which. */}
              <span className="text-xs text-muted-foreground tabular-nums">
                {Math.round(c.confidence * 100)}% match
              </span>
            </div>
            {c.excerpt ? (
              <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
                {c.excerpt}
              </p>
            ) : null}
          </li>
        ))}
      </ol>
    </div>
  )
}

function Rating({ slug, query, answer }: { slug: string; query: string; answer: string }) {
  const rate = async (rating: 1 | -1) => {
    const result = await rateKnowledgeAnswerAction(slug, query, answer, rating)
    if (result.error) toast.error(result.error.message)
    else toast.success(rating === 1 ? "Marked helpful" : "Marked unhelpful")
  }

  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-muted-foreground">Was this useful?</span>
      {/* Two buttons, one per rating, rather than a toggle: the useful state is
          "both pressed" and the only honest rendering of that is both shown as
          selected. A toggle cannot express it. */}
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="h-7 gap-1 px-2"
        onClick={() => void rate(1)}
      >
        <ThumbsUp className="size-3" />
        <span className="sr-only">Mark helpful</span>
      </Button>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="h-7 w-7 p-0"
        onClick={() => void rate(-1)}
      >
        <ThumbsDown className="size-3" />
        <span className="sr-only">Mark unhelpful</span>
      </Button>
    </div>
  )
}

export function AskPanel({ slug, query }: { slug: string; query: string }) {
  /* The state is the whole `Result`, not the unwrapped payload. `useActionState`
     types the reducer as `(state, payload) => S`, so narrowing the state to the
     payload alone would mean claiming the action returns `KnowledgeAnswer` — which
     is false, since it resolves to the `{ data } | { error }` union. The union is
     what the action actually returns and what makes the error branch reachable. */
  const [state, formAction, isPending] = useActionState<Result<KnowledgeAnswer> | null, FormData>(
    askKnowledgeAction.bind(null, slug),
    null
  )

  const answer = state && "data" in state && state.data ? state.data : null
  const error = state && "error" in state && state.error ? state.error : null

  return (
    <div className="space-y-4">
      <form action={formAction} className="flex gap-2">
        <Input
          name="query"
          defaultValue={query}
          placeholder="Ask your documents — e.g. refund window on a booking"
          className="flex-1 focus-visible:ring-brand"
          maxLength={4000}
          required
        />
        <Button type="submit" variant="brand" className="rounded-sm" disabled={isPending}>
          {isPending ? <Spinner className="size-4" /> : <BookOpen className="size-4" />}
          {isPending ? "Searching" : "Ask"}
        </Button>
      </form>

      {!answer && !error ? (
        <div className="flex flex-wrap gap-2">
          {EXAMPLES.map((ex) => (
            <form key={ex} action={formAction}>
              <input type="hidden" name="query" value={ex} />
              <Button
                type="submit"
                variant="outline"
                size="sm"
                className="h-7 rounded-full text-xs font-normal"
                disabled={isPending}
              >
                {ex}
              </Button>
            </form>
          ))}
        </div>
      ) : null}

      {error ? (
        <Alert variant="destructive">
          <TriangleAlert className="size-4" />
          <AlertTitle>Could not answer</AlertTitle>
          <AlertDescription>{error.message}</AlertDescription>
        </Alert>
      ) : null}

      {answer ? (
        <div className="space-y-4 rounded-md border p-4">
          <div className="flex flex-wrap items-center gap-2">
            <ConfidenceBadge answer={answer} />
            <span className="text-xs text-muted-foreground tabular-nums">
              {Math.round(answer.confidence.topConfidence * 100)}% confident
              {answer.faithfulness
                ? ` · ${Math.round(answer.faithfulness * 100)}% faithful`
                : ""}
            </span>
            {answer.cached ? (
              <Badge variant="ghost" className="text-[11px]">
                {answer.cacheType === "semantic" ? "Similar question" : "Cached"}
              </Badge>
            ) : null}
          </div>

          <div className="whitespace-pre-wrap text-sm leading-relaxed">{answer.answer}</div>

          {answer.refused ? (
            <p className="text-xs text-muted-foreground">
              Nothing in the knowledge base scored high enough to answer this. Add the
              document it should have come from and try again.
            </p>
          ) : null}

          {answer.warning ? (
            <Alert variant="destructive">
              <TriangleAlert className="size-4" />
              <AlertTitle>Some claims were not found in the sources</AlertTitle>
              <AlertDescription>
                Check these against the documents before relying on them.
              </AlertDescription>
            </Alert>
          ) : null}

          <Citations answer={answer} />

          {!answer.refused ? <Rating slug={slug} query={query} answer={answer.answer} /> : null}
        </div>
      ) : null}
    </div>
  )
}
