"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

/**
 * The keyboard hint for a composer that sends on ⌘/Ctrl + Enter.
 *
 * Both the inbox reply and the WhatsApp card accept the shortcut, and until now
 * neither advertised it — a hidden accelerator is not a micro-interaction, it is
 * a secret, and it is the kind that gets rediscovered by accident months later.
 *
 * Platform-aware on purpose: the handlers accept `metaKey || ctrlKey`, but a hint
 * that says "⌘" is wrong for every Windows machine, and the intended audience
 * (sales and accounts staff in Ahmedabad) is overwhelmingly on Windows. Printing
 * the wrong modifier is worse than printing none.
 *
 * `useSyncExternalStore`, not `useEffect` + `setState`. The platform is a browser
 * global read during render; reaching for it through an effect means a state
 * update on every composer after mount, which cascades a second render pass and
 * briefly shows the wrong glyph. The store form also gives us `getServerSnapshot`,
 * so the server renders "Ctrl" and React reconciles to "⌘" on the client without
 * a hydration mismatch — and with no layout reservation needed, because a value
 * is always present.
 */
const IS_APPLE = () =>
  typeof navigator !== "undefined" &&
  /Mac|iPhone|iPad|iPod/.test(navigator.platform || navigator.userAgent)

const subscribe = () => () => {}

export function SendHint({ className }: { className?: string }) {
  const isApple = React.useSyncExternalStore(subscribe, IS_APPLE, () => false)

  return (
    <span
      aria-hidden
      className={cn(
        "inline-flex shrink-0 items-center gap-0.5 text-[10px] font-medium text-muted-foreground/70",
        className
      )}
    >
      {isApple ? "⌘" : "Ctrl"}
      <kbd className="font-sans leading-none">↵</kbd>
    </span>
  )
}
