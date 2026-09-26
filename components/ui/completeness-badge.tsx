import { cn } from "@/lib/utils"
import {
  completenessBarColor,
  completenessTextColor,
  type ContactCompleteness,
  type DealCompleteness,
} from "@/lib/completeness"

export function CompletenessBadge({
  data,
  showBar = true,
  showLabel = true,
  className,
}: {
  data: ContactCompleteness | DealCompleteness
  showBar?: boolean
  showLabel?: boolean
  className?: string
}) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      {showLabel && (
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-muted-foreground">Completeness</span>
          <span className={cn("text-xs font-semibold tabular-nums", completenessTextColor(data.color))}>
            {data.score}%
          </span>
        </div>
      )}
      {showBar && (
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
          <div
            className={cn("h-full rounded-full transition-all", completenessBarColor(data.color))}
            style={{ width: `${data.score}%` }}
          />
        </div>
      )}
      {data.missing.length > 0 && (
        <p className="text-[10px] text-muted-foreground">
          Missing: {data.missing.slice(0, 3).join(", ")}
          {data.missing.length > 3 && ` +${data.missing.length - 3} more`}
        </p>
      )}
    </div>
  )
}
