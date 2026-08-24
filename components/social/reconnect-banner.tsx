import { AlertTriangle } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"

export function ReconnectBanner({
  providers,
}: {
  providers: string[]
}) {
  if (providers.length === 0) return null
  const label = providers.join(", ")
  return (
    <Alert variant="default" className="border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100">
      <AlertTriangle className="size-4" />
      <AlertTitle>Reconnect required</AlertTitle>
      <AlertDescription>
        {providers.length === 1
          ? `${label} needs re-authentication. Reconnect to resume syncing.`
          : `The following connections need re-authentication: ${label}. Reconnect to resume syncing.`}
      </AlertDescription>
    </Alert>
  )
}
