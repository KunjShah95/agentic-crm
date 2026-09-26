# Phase 1 — Design System & Tokens Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the Estate360 design direction enforceable — collapse radius to 4 sanctioned steps, bound Fraunces to page titles and stat numerals, replace 65 raw palette colors with semantic status tokens, strip `font-mono` chrome, and add warm surface tokens — with automated conformance tests so the rules cannot silently regress.

**Architecture:** All token changes land in `app/globals.css` (`@theme inline` block for Tailwind exposure, `:root`/`.dark` for raw values). Enforcement is a source-scanning vitest suite: a shared helper walks the in-scope directories and returns regex matches, and per-domain test files assert banned patterns are absent. The suite is the real deliverable — migrations are mechanical once a test fails.

**Tech Stack:** Next.js 15 App Router, Tailwind CSS v4 (`@theme inline`), OKLCH color tokens, Vitest 4 + jsdom, @testing-library/react, shadcn/ui (`components/ui/` — vendored, treated as read-only).

---

## Critical scope correction (read before Task 1)

The spec's verification says *"No `rounded-lg|xl|2xl|3xl|4xl` on card, table, or dialog containers."* Taken literally as a CSS-level ban, this **breaks the UI kit**: 29 of the 37 files in `components/ui/` use `rounded-lg` (20×), `rounded-xl` (9×), `rounded-md` (10×), `rounded-sm` (3×) internally. Tailwind v4 ships these as built-in utilities and they cannot be removed without forking shadcn upstream.

**Resolution:** the ban applies to **application code only**. `components/ui/**` is vendored shadcn and is excluded from every conformance scope. It keeps working radii until upstream restyles it. All other spec scopes are unchanged.

## File Structure

**Created:**

| Path | Responsibility |
|---|---|
| `tests/helpers/source-scan.ts` | Walks in-scope dirs, returns `{file, line, text}` for regex matches. Single place that defines the Phase 1 scope. |
| `tests/unit/design-tokens.test.ts` | Asserts `globals.css` **defines** the required tokens and **omits** the retired ones. |
| `tests/unit/token-radius.test.ts` | Asserts no arbitrary-radius or off-scale radius in app code. |
| `tests/unit/token-type.test.ts` | Asserts no global display-font rule, and `font-mono` is confined to money/ID/API-key contexts. |
| `tests/unit/token-status.test.ts` | Asserts no raw palette colors in app code; all five status pairs defined in both modes. |
| `tests/unit/token-surfaces.test.ts` | Asserts surface/elevation tokens defined and no decorative gradient wrappers in app code. |

**Modified:** `app/globals.css` (all token definitions) plus 30 application files across 9 migration tasks.

**Unchanged (read-only):** `components/ui/**` (vendored shadcn), `components/landing/**`, `app/(marketing)/**` (Phase 4), `app/(public)/**`.

---

### Task 1: Source-scan helper + radius token collapse

Establishes the test harness and the radius scale. Every later task reuses the helper.

**Files:**
- Create: `tests/helpers/source-scan.ts`
- Create: `tests/unit/design-tokens.test.ts`
- Create: `tests/unit/token-radius.test.ts`
- Modify: `app/globals.css:46-52` (`@theme inline` radius block), `app/globals.css:95` (`--radius` in `:root`)

- [ ] **Step 1: Write the source-scan helper**

Create `tests/helpers/source-scan.ts`:

```ts
import fs from "node:fs"
import path from "node:path"

export const REPO_ROOT = path.resolve(__dirname, "..", "..")

/**
 * Phase 1 conformance scope. Vendored shadcn (components/ui) and the
 * marketing tree are deliberately excluded — see the plan's
 * "Critical scope correction" section.
 */
export const SCOPE = [
  "app/(app)",
  "components/shell",
  "components/dashboard",
  "components/contacts",
  "components/deals",
  "components/settings",
  "components/property",
] as const

function walk(dir: string, out: string[] = []): string[] {
  const abs = path.join(REPO_ROOT, dir)
  if (!fs.existsSync(abs)) return out
  for (const entry of fs.readdirSync(abs, { withFileTypes: true })) {
    const full = path.join(abs, entry.name)
    if (entry.isDirectory()) walk(path.relative(REPO_ROOT, full), out)
    else if (/\.tsx?$/.test(entry.name)) out.push(full)
  }
  return out
}

export type Violation = { file: string; line: number; text: string }

export function scan(pattern: RegExp, roots: readonly string[] = SCOPE): Violation[] {
  const re = new RegExp(pattern.source, pattern.flags.replace("g", ""))
  const found: Violation[] = []
  for (const root of roots) {
    for (const file of walk(root)) {
      fs.readFileSync(file, "utf8")
        .split(/\r?\n/)
        .forEach((text, i) => {
          if (re.test(text)) {
            found.push({
              file: path.relative(REPO_ROOT, file).replace(/\\/g, "/"),
              line: i + 1,
              text: text.trim().slice(0, 120),
            })
          }
        })
    }
  }
  return found
}

export function css(): string {
  return fs.readFileSync(path.join(REPO_ROOT, "app/globals.css"), "utf8")
}

export function describeViolations(v: Violation[]): string {
  return v.map((x) => `  ${x.file}:${x.line}  ${x.text}`).join("\n")
}
```

- [ ] **Step 2: Write the failing token-definition test**

Create `tests/unit/design-tokens.test.ts`:

```ts
import { describe, it, expect } from "vitest"
import { css } from "../helpers/source-scan"

const sheet = css()

describe("globals.css radius tokens", () => {
  it("defines the four sanctioned radius steps", () => {
    for (const step of ["xs", "sm", "md", "full"]) {
      expect(sheet, `missing --radius-${step}`).toMatch(
        new RegExp(`--radius-${step}:`)
      )
    }
  })

  it("retires the oversized radius steps", () => {
    for (const step of ["lg", "xl", "2xl", "3xl", "4xl"]) {
      expect(sheet, `--radius-${step} should be removed`).not.toMatch(
        new RegExp(`--radius-${step}:`)
      )
    }
  })
})
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `npx vitest run tests/unit/design-tokens.test.ts`
Expected: FAIL — `--radius-xs:` not found in `app/globals.css`.

- [ ] **Step 4: Collapse the radius scale**

In `app/globals.css`, replace the `@theme inline` radius block (lines 46-52):

```css
  --radius-xs: 4px;
  --radius-sm: 6px;
  --radius-md: 10px;
```

Delete the `--radius: 0.75rem;` declaration from `:root` (line 95) — every consumer now reads a concrete step, so the base value is dead.

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run tests/unit/design-tokens.test.ts`
Expected: PASS — 2 tests.

- [ ] **Step 6: Write the failing radius conformance test**

Create `tests/unit/token-radius.test.ts`:

```ts
import { describe, it, expect } from "vitest"
import { scan, describeViolations } from "../helpers/source-scan"

describe("radius conformance", () => {
  it("uses no arbitrary px radius in app code", () => {
    const v = scan(/rounded-\[\d+px\]/)
    expect(v, `arbitrary radius found:\n${describeViolations(v)}`).toEqual([])
  })

  it("restricts card, table, and dialog surfaces to rounded-md", () => {
    const v = scan(/rounded-(lg|xl|2xl|3xl|4xl)[^a-zA-Z-]/)
    expect(v, `off-scale radius found:\n${describeViolations(v)}`).toEqual([])
  })
})
```

- [ ] **Step 7: Run the test to verify it fails**

Run: `npx vitest run tests/unit/token-radius.test.ts`
Expected: FAIL — 13+ arbitrary-radius violations listed.

- [ ] **Step 8: Migrate arbitrary radii to `rounded-md`**

In each of these 13 files, replace `rounded-[20px]` with `rounded-md`:

```
app/(app)/[workspace]/bookings/page.tsx
app/(app)/[workspace]/channel-partners/page.tsx
app/(app)/[workspace]/contacts/loading.tsx
app/(app)/[workspace]/contacts/page.tsx
app/(app)/[workspace]/deals/loading.tsx
app/(app)/[workspace]/deals/page.tsx
app/(app)/[workspace]/documents/page.tsx
app/(app)/[workspace]/inbox/page.tsx
app/(app)/[workspace]/organizations/page.tsx
app/(app)/[workspace]/projects/page.tsx
app/(app)/[workspace]/site-visits/page.tsx
app/(app)/[workspace]/tasks/page.tsx
components/shell/page-header.tsx
```

Verify none remain in scope:

```powershell
Get-ChildItem -Recurse -Filter *.tsx -Path 'app\(app)','components\shell','components\dashboard','components\contacts','components\deals','components\settings','components\property' | Select-String 'rounded-\[\d+px\]'
```

Expected: no output.

- [ ] **Step 9: Run the radius tests to verify they pass**

Run: `npx vitest run tests/unit/token-radius.test.ts tests/unit/design-tokens.test.ts`
Expected: the arbitrary-radius test PASSES. The `rounded-lg|xl` test will still FAIL — that is Task 2's work. Confirm the failure list contains only `rounded-lg`/`rounded-xl`/`rounded-2xl` on card/table/dialog containers, which is expected at this point.

- [ ] **Step 10: Commit**

```powershell
git add tests/helpers/source-scan.ts tests/unit/design-tokens.test.ts tests/unit/token-radius.test.ts app/globals.css "app/(app)" components/shell
git commit -m "feat(design-system): collapse radius scale to 4 steps, add conformance harness"
```

---

### Task 2: Migrate off-scale radius steps

Clears the remaining `rounded-lg` / `rounded-xl` / `rounded-2xl` on card, table, and dialog containers in app code.

**Files:**
- Modify: the app-code files reported by the failing test from Task 1 Step 9

- [ ] **Step 1: List the exact violations**

Run: `npx vitest run tests/unit/token-radius.test.ts`
Expected: FAIL with a list of `file:line` pairs. Copy that list — it is the work list.

- [ ] **Step 2: Migrate each violation to the sanctioned step**

Apply this mapping at each reported location:

| Was | Becomes | Used for |
|---|---|---|
| `rounded-lg` | `rounded-md` | cards, tables, sections, dialogs |
| `rounded-xl` | `rounded-md` | cards, tables, stat tiles |
| `rounded-2xl` | `rounded-md` | page header containers |
| `rounded-full` | *leave* | avatars, pills, badges |
| `rounded-sm` | *leave* | buttons, inputs, selects |
| `rounded-xs` | *leave* | dot indicators, tags |

Do **not** change `rounded-full`, `rounded-sm`, or `rounded-xs` — they are sanctioned.

- [ ] **Step 3: Run the test to verify it passes**

Run: `npx vitest run tests/unit/token-radius.test.ts`
Expected: PASS — 2 tests.

- [ ] **Step 4: Typecheck**

Run: `npm run typecheck`
Expected: clean, except the known pre-existing
`.next/types/validator.ts(260,39)` error referencing a missing `/today/page.js`.

- [ ] **Step 5: Commit**

```powershell
git add -A
git commit -m "refactor(design-system): migrate off-scale radii to sanctioned steps"
```

---

### Task 3: Bound Fraunces to page titles and stat numerals

Removes the global `h1,h2,h3 → font-display` rule that currently renders a 14px serif as every card title.

**Files:**
- Create: `tests/unit/token-type.test.ts`
- Modify: `app/globals.css:164-169`

- [ ] **Step 1: Write the failing type-scope test**

Create `tests/unit/token-type.test.ts`:

```ts
import { describe, it, expect } from "vitest"
import { scan, css, describeViolations } from "../helpers/source-scan"

describe("type scope", () => {
  it("has no global display-font rule on headings", () => {
    const sheet = css()
    const globalRule = /h1,\s*h2,\s*h3\s*\{[^}]*font-family/
    expect(sheet, "globals.css still assigns font-display to all h1-h3").not.toMatch(
      globalRule
    )
  })

  it("keeps font-mono out of UI chrome", () => {
    // Money, IDs and API keys legitimately use mono. Everything else is chrome.
    const chrome = scan(/font-mono/)
    const allowed = chrome.filter((v) =>
      /(apiKey|api_key|token|secret|webhook|\bid\b|mono|amount|price|value|currency|INR|₹|hash|uuid|sku|code)/i.test(
        v.text
      )
    )
    const offenders = chrome.filter((v) => !allowed.includes(v))
    expect(
      offenders.length,
      `font-mono chrome found (${offenders.length}):\n${describeViolations(offenders.slice(0, 25))}`
    ).toEqual([])
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/unit/token-type.test.ts`
Expected: FAIL on both tests — the global rule exists, and there are ~50 `font-mono` chrome usages.

- [ ] **Step 3: Remove the global display rule**

In `app/globals.css`, delete the `h1, h2, h3` block (lines 164-169) but keep `text-wrap: balance` as a reusable utility. Add to the same `@layer base`:

```css
  .text-balance {
    text-wrap: balance;
  }
```

- [ ] **Step 4: Verify the first assertion passes**

Run: `npx vitest run tests/unit/token-type.test.ts -t "no global display-font rule"`
Expected: PASS.

- [ ] **Step 5: Strip `font-mono` chrome, file by file**

The 58 usages live in these 13 files:

| Usages | File |
|---|---|
| 24 | `app/(app)/[workspace]/reports/page.tsx` |
| 9 | `components/settings/extended-settings-tabs.tsx` |
| 6 | `app/(app)/[workspace]/ai/page.tsx` |
| 4 | `app/(app)/[workspace]/association/page.tsx` |
| 3 | `app/(app)/[workspace]/dashboard/page.tsx` |
| 3 | `app/(app)/[workspace]/inbox/page.tsx` |
| 2 | `app/(app)/[workspace]/tasks/page.tsx` |
| 2 | `components/deals/kanban-board.tsx` |
| 1 each | `components/deals/company-take-card.tsx`, `app/(app)/[workspace]/projects/page.tsx`, `app/(app)/[workspace]/contacts/page.tsx`, `app/(app)/[workspace]/documents/page.tsx`, `components/shell/command-menu.tsx` |

For each, remove the `font-mono` class. Two recurring patterns to fix first:

- **Uppercase tracked badges** (`font-mono text-[10px] uppercase tracking-[0.08em]`) — drop `font-mono`, keep size; the uppercase+tracking is itself the tic
- **Workspace-name / type badges** (`font-mono text-xs`) — drop `font-mono` only

Keep `font-mono` on: the API key input in `extended-settings-tabs.tsx` (that is a literal secret value), webhook URL fields, and any currency figure where tabular alignment matters.

- [ ] **Step 6: Run the test to verify it passes**

Run: `npx vitest run tests/unit/token-type.test.ts`
Expected: PASS — 2 tests.

- [ ] **Step 7: Commit**

```powershell
git add tests/unit/token-type.test.ts app/globals.css "app/(app)" components/shell components/deals components/settings
git commit -m "refactor(design-system): bound Fraunces to page titles, strip mono chrome"
```

---

### Task 4: Warm surface and elevation tokens

Establishes the Direction A canvas — hairline borders for static containment, shadows for overlays only.

**Files:**
- Create: `tests/unit/token-surfaces.test.ts`
- Modify: `app/globals.css` — `@theme inline` (add 4 entries after `--color-border`, line 32), `:root` (after `--border`, line 87), `.dark` (after `--border`, line 132)

- [ ] **Step 1: Write the failing surface test**

Create `tests/unit/token-surfaces.test.ts`:

```ts
import { describe, it, expect } from "vitest"
import { scan, css, describeViolations } from "../helpers/source-scan"

const sheet = css()

describe("surface tokens", () => {
  it("defines canvas, raised, sunken, and hairline in both modes", () => {
    for (const token of [
      "--surface-canvas",
      "--surface-raised",
      "--surface-sunken",
      "--hairline",
    ]) {
      const occurrences = sheet.split(`--${token.slice(2)}:`).length - 1
      expect(occurrences, `${token} must be defined in :root and .dark`).toBe(2)
    }
  })

  it("retains the three elevation steps", () => {
    for (const step of ["e1", "e2", "e3"]) {
      expect(sheet, `missing --shadow-${step}`).toMatch(
        new RegExp(`--shadow-${step}:`)
      )
    }
  })

  it("has no decorative gradient wrappers in app code", () => {
    const v = scan(/blur-2xl/)
    expect(v, `decorative blur found:\n${describeViolations(v)}`).toEqual([])
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/unit/token-surfaces.test.ts`
Expected: FAIL — surface tokens undefined; `blur-2xl` present in several page headers.

- [ ] **Step 3: Add the surface tokens**

In `app/globals.css` `@theme inline`, after the `--color-border` line, add:

```css
  --color-surface-canvas: var(--surface-canvas);
  --color-surface-raised: var(--surface-raised);
  --color-surface-sunken: var(--surface-sunken);
  --color-hairline: var(--hairline);
```

In `:root`, after `--border: oklch(0.90 0.004 70);` add:

```css
  --surface-canvas: oklch(0.988 0.004 82);
  --surface-raised: oklch(0.997 0.002 85);
  --surface-sunken: oklch(0.978 0.005 80);
  --hairline: oklch(0.900 0.006 70);
```

In `.dark`, after `--border: oklch(1 0 0 / 8%);` add:

```css
  --surface-canvas: oklch(0.145 0.005 62);
  --surface-raised: oklch(0.185 0.004 62);
  --surface-sunken: oklch(0.165 0.004 62);
  --hairline: oklch(1 0 0 / 9%);
```

- [ ] **Step 4: Point the app background at the canvas token**

In `app/globals.css` `@layer base`, change `body` to:

```css
  body {
    @apply text-foreground;
    background-color: var(--surface-canvas);
  }
```

- [ ] **Step 5: Remove decorative gradient wrappers**

Delete the `aria-hidden` gradient-blob blocks from these page headers — the whole `<div aria-hidden className="pointer-events-none absolute inset-0">…</div>` subtree plus its now-unused siblings:

```
app/(app)/[workspace]/contacts/page.tsx
app/(app)/[workspace]/deals/page.tsx
app/(app)/[workspace]/projects/page.tsx
app/(app)/[workspace]/bookings/page.tsx
components/shell/page-header.tsx
```

In `components/shell/page-header.tsx` this also means deleting the violet/blue/cyan aurora (lines 24-27) — those hues are off-brand against the copper accent.

- [ ] **Step 6: Run the test to verify it passes**

Run: `npx vitest run tests/unit/token-surfaces.test.ts`
Expected: PASS — 3 tests.

- [ ] **Step 7: Commit**

```powershell
git add tests/unit/token-surfaces.test.ts app/globals.css "app/(app)" components/shell
git commit -m "feat(design-system): add warm surface tokens, strip decorative gradients"
```

---

### Task 5: Bring `PageHeader` and `Stat` to spec

The shared header primitive already exists but is off-spec: 22px title, uppercase tracked label, 15px sans numeral, off-brand aurora. Phase 2 depends on this being correct.

**Files:**
- Modify: `components/shell/page-header.tsx:32` (title), `:50-59` (`Stat`)
- Test: `tests/unit/page-header.test.tsx`

- [ ] **Step 1: Write the failing component test**

Create `tests/unit/page-header.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react"
import { describe, it, expect } from "vitest"
import { PageHeader, Stat } from "@/components/shell/page-header"

describe("PageHeader", () => {
  it("renders the title as a level-one heading", () => {
    render(<PageHeader title="Deals" description="14 open opportunities" />)
    const h1 = screen.getByRole("heading", { level: 1 })
    expect(h1).toHaveTextContent("Deals")
    expect(h1.className).toContain("font-display")
  })

  it("uses the sanctioned radius", () => {
    render(<PageHeader title="Deals" />)
    expect(screen.getByRole("heading", { level: 1 }).closest("div"))
      .toHaveClass("rounded-md")
  })
})

describe("Stat", () => {
  it("sets the numeral in the display face", () => {
    render(<Stat label="Open deals" value="14" />)
    const numeral = screen.getByText("14")
    expect(numeral.className).toContain("font-display")
  })

  it("does not uppercase or track the label", () => {
    render(<Stat label="Open deals" value="14" />)
    const label = screen.getByText(/Open deals/)
    expect(label.className).not.toContain("uppercase")
    expect(label.className).not.toContain("tracking-[0.08em]")
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/unit/page-header.test.tsx`
Expected: FAIL — no `font-display` on the title or numeral; `uppercase` present on the label.

- [ ] **Step 3: Bring `PageHeader` to spec**

In `components/shell/page-header.tsx`, change the title (line 32) to:

```tsx
<h1 className="font-display text-[30px] font-medium leading-none tracking-[-0.025em]">
  {title}
</h1>
```

Change the container (line 22) to:

```tsx
<div className={cn("relative rounded-md border bg-card", className)}>
```

- [ ] **Step 4: Bring `Stat` to spec**

Replace the `Stat` function (lines 50-59) with:

```tsx
export function Stat({
  label,
  value,
  sub,
  icon,
}: {
  label: string
  value: React.ReactNode
  sub?: string
  icon?: React.ReactNode
}) {
  return (
    <div className="rounded-md border bg-card px-3.5 py-3">
      <div className="flex items-center gap-1.5 text-[11.5px] font-medium text-muted-foreground">
        {icon} {label}
      </div>
      <div className="mt-1.5 font-display text-[28px] font-medium leading-none tracking-[-0.02em] tabular-nums">
        {value}
      </div>
      {sub ? <div className="mt-1 text-xs text-muted-foreground">{sub}</div> : null}
    </div>
  )
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run tests/unit/page-header.test.tsx`
Expected: PASS — 4 tests.

- [ ] **Step 6: Commit**

```powershell
git add tests/unit/page-header.test.tsx components/shell/page-header.tsx
git commit -m "feat(design-system): bring PageHeader and Stat to type and surface spec"
```

---

### Task 6: Semantic status tokens

Replaces the 65 raw palette colors with five token pairs, so dark mode stops being a per-component patch.

**Files:**
- Create: `tests/unit/token-status.test.ts`
- Modify: `app/globals.css` — `@theme inline`, `:root`, `.dark`

- [ ] **Step 1: Write the failing status test**

Create `tests/unit/token-status.test.ts`:

```ts
import { describe, it, expect } from "vitest"
import { scan, css, describeViolations } from "../helpers/source-scan"

const sheet = css()
const PALETTE =
  /(text|bg|border|ring|from|to|via)-(emerald|amber|blue|red|green|orange|yellow|violet|purple|rose|indigo|teal|cyan|slate)-(400|500|600|700)/

const STATUSES = ["positive", "caution", "critical", "info", "neutral"] as const

describe("status tokens", () => {
  it("defines every status pair in both modes", () => {
    for (const s of STATUSES) {
      for (const slot of ["bg", "fg"]) {
        const token = `--status-${s}-${slot}`
        const occurrences = sheet.split(`${token}:`).length - 1
        expect(occurrences, `${token} must be defined in :root and .dark`).toBe(2)
      }
    }
  })

  it("uses no raw palette color in app code", () => {
    const v = scan(PALETTE)
    expect(v, `raw palette color found:\n${describeViolations(v)}`).toEqual([])
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/unit/token-status.test.ts`
Expected: FAIL — status tokens undefined; ~60 raw palette usages listed.

- [ ] **Step 3: Add the status tokens**

In `@theme inline`, after the `--color-hairline` entries added in Task 4:

```css
  --color-status-positive-bg: var(--status-positive-bg);
  --color-status-positive-fg: var(--status-positive-fg);
  --color-status-caution-bg: var(--status-caution-bg);
  --color-status-caution-fg: var(--status-caution-fg);
  --color-status-critical-bg: var(--status-critical-bg);
  --color-status-critical-fg: var(--status-critical-fg);
  --color-status-info-bg: var(--status-info-bg);
  --color-status-info-fg: var(--status-info-fg);
  --color-status-neutral-bg: var(--status-neutral-bg);
  --color-status-neutral-fg: var(--status-neutral-fg);
```

In `:root`:

```css
  --status-positive-bg: oklch(0.955 0.025 155);
  --status-positive-fg: oklch(0.52 0.11 155);
  --status-caution-bg: oklch(0.960 0.030 78);
  --status-caution-fg: oklch(0.55 0.13 68);
  --status-critical-bg: oklch(0.955 0.022 27);
  --status-critical-fg: oklch(0.55 0.19 27);
  --status-info-bg: oklch(0.955 0.020 245);
  --status-info-fg: oklch(0.52 0.12 245);
  --status-neutral-bg: oklch(0.965 0.004 78);
  --status-neutral-fg: oklch(0.48 0.006 60);
```

In `.dark` — same hues, raised luminance:

```css
  --status-positive-bg: oklch(0.24 0.030 155);
  --status-positive-fg: oklch(0.76 0.11 155);
  --status-caution-bg: oklch(0.25 0.032 78);
  --status-caution-fg: oklch(0.78 0.12 68);
  --status-critical-bg: oklch(0.25 0.038 27);
  --status-critical-fg: oklch(0.74 0.15 27);
  --status-info-bg: oklch(0.24 0.030 245);
  --status-info-fg: oklch(0.75 0.11 245);
  --status-neutral-bg: oklch(0.25 0.005 62);
  --status-neutral-fg: oklch(0.70 0.006 60);
```

- [ ] **Step 4: Verify the definition test passes**

Run: `npx vitest run tests/unit/token-status.test.ts -t "defines every status pair"`
Expected: PASS.

- [ ] **Step 5: Migrate the 60 usages, file by file**

The failing test lists every `file:line`. Work through them with this mapping:

| Was | Becomes |
|---|---|
| `bg-emerald-500/10` + `text-emerald-600` + `dark:text-emerald-400` | `bg-status-positive-bg` + `text-status-positive-fg` |
| `bg-amber-500/10` + `text-amber-600` + `dark:text-amber-400` | `bg-status-caution-bg` + `text-status-caution-fg` |
| `bg-red-500/10` + `text-red-600` + `dark:text-red-400` | `bg-status-critical-bg` + `text-status-critical-fg` |
| `bg-blue-500/10` + `text-blue-600` + `dark:text-blue-400` | `bg-status-info-bg` + `text-status-info-fg` |
| `text-slate-*`, `text-gray-*` | `text-status-neutral-fg` |

The `dark:` variants are **deleted**, not translated — the token pair handles both modes.

Heaviest files first:

```
app/(app)/[workspace]/reports/page.tsx              9
components/dashboard/follow-up-nudge.tsx            6
components/contacts/contact-form-dialog.tsx         4
app/(app)/[workspace]/tasks/page.tsx                4
components/property/InventoryGrid.tsx               4
components/contacts/import-contacts-dialog.tsx      3
app/(app)/[workspace]/settings/social/page.tsx      3
components/settings/extended-settings-tabs.tsx      3
app/(app)/[workspace]/bookings/page.tsx             2
components/shell/page-header.tsx                    2
components/contacts/whatsapp-contact-card.tsx       2
app/(app)/[workspace]/documents/page.tsx            2
app/(app)/[workspace]/contacts/page.tsx             2
app/(app)/[workspace]/channel-partners/page.tsx     2
app/(app)/[workspace]/organizations/page.tsx        2
app/(app)/[workspace]/site-visits/page.tsx          2
app/(app)/[workspace]/inbox/page.tsx                2
app/(app)/[workspace]/deals/page.tsx                1
components/settings/tag-manager.tsx                  1
```

**Exception — pipeline stage colors.** `PipelineStage.color` is user-authored hex stored in the database. It is data, not chrome, and stays inline: it renders as a dot via `style={{ backgroundColor: stage.color }}` beside neutral text. Do not convert those to status tokens.

- [ ] **Step 6: Run the test to verify it passes**

Run: `npx vitest run tests/unit/token-status.test.ts`
Expected: PASS — 2 tests.

- [ ] **Step 7: Commit**

```powershell
git add tests/unit/token-status.test.ts app/globals.css "app/(app)" components/shell components/dashboard components/contacts components/deals components/settings components/property
git commit -m "feat(design-system): add semantic status tokens, replace 60 raw palette colors"
```

---

### Task 7: Full-suite regression + build

Confirms the token work broke nothing before Phase 2 starts.

**Files:** none modified unless a failure surfaces

- [ ] **Step 1: Run the full unit suite**

Run: `npm test`
Expected: all pre-existing tests PASS. `inbox-timeline.test.tsx` and `inventory-grid.test.tsx` are the likely canaries — they render components whose classes changed.

- [ ] **Step 2: Run the typecheck**

Run: `npm run typecheck`
Expected: clean except the known pre-existing
`.next/types/validator.ts(260,39)` error.

- [ ] **Step 3: Run the linter**

Run: `npm run lint`
Expected: no new errors. The removal of `font-mono` and gradient wrappers can leave unused imports — clear them.

- [ ] **Step 4: Run the production build**

Run: `npm run build`
Expected: build succeeds. A failure here usually means a token referenced a Tailwind class that no longer exists.

- [ ] **Step 5: Commit any fixes**

```powershell
git add -A
git commit -m "fix(design-system): clear unused imports after token migration"
```

---

### Task 8: Visual sign-off on the warm canvas

The one decision in the spec with a revert path. Must happen before Phase 2 builds on these tokens.

**Files:** none

- [ ] **Step 1: Start the dev server**

Run: `npm run dev`

- [ ] **Step 2: Inspect six screens in light mode**

Check: dashboard, contacts, deals, projects, bookings, settings.

- [ ] **Step 3: Inspect the same six in dark mode**

Toggle via the theme switcher. Confirm the dark canvas reads as warm charcoal, not neutral grey.

- [ ] **Step 4: Make the canvas call**

The question: does `#FBF9F5` read as **paper** or as **beige**?

- Reads as paper → keep. Note it here and move on.
- Reads as beige → revert the one token in `app/globals.css`:

```css
  --surface-canvas: oklch(1 0 0);
```

and the matching `.dark` value to `oklch(0.145 0 0)`. Warm borders and status tokens stay. Re-run `npx vitest run tests/unit/token-surfaces.test.ts` to confirm the token test still passes (it checks definition, not value).

- [ ] **Step 5: Stop the dev server**

Press `Ctrl+C`.

---

## Self-Review

**Spec coverage**

| Spec section | Tasks |
|---|---|
| 1. Type — remove global rule | 3 |
| 1. Type — Fraunces confined to h1 + stat numerals | 3, 5 |
| 1. Type — type scale | 3, 5 |
| 1. Type — `font-mono` policy (58 → ≤12) | 3 |
| 2. Radius — collapse to 4 steps | 1 |
| 2. Radius — migration map | 1, 2 |
| 2. Radius — no arbitrary radius remains | 1, 2 |
| 3. Status tokens — 5 pairs, both modes | 6 |
| 3. Status tokens — 65 usages migrated | 6 |
| 3. Pipeline stage colors stay inline | 6 (documented exception) |
| 4. Surfaces — canvas/raised/sunken/hairline | 4 |
| 4. Surfaces — border not shadow for static | 4, 5 |
| 4. Surfaces — dark mirrors warm ramp | 4, 8 |
| 4. Surfaces — gradient blobs removed | 4 |
| 5. Page header contract | 5 (mechanical), 3 (radius), 4 (decoration) |
| Verification greps | 1, 3, 4, 6 (as tests) |
| Canvas revert path | 8 |

No spec section is unmapped.

**Deviation from spec, deliberate:** the spec's *"No `rounded-lg|xl|2xl|3xl|4xl` on card, table, and dialog containers"* is scoped to application code, not the CSS layer. 29 of 37 `components/ui/` files use those utilities internally; banning them at the token level would fork shadcn. Recorded in the plan header.

**Type consistency:** `--radius-{xs,sm,md}` are defined once in `@theme inline` (Task 1) and consumed as `rounded-{xs,sm,md}` throughout. `--surface-*` and `--hairline` are defined in Tasks 4 and consumed by `body` in the same task. `--status-*` are defined in Task 6 and consumed in the same task. `Stat` signature is unchanged from the original, so `projects/page.tsx` and `projects/[projectId]/page.tsx` — the two existing adopters — need no call-site edits.

**Ordering:** Tasks 1→2 must precede 3 (Task 2's radius sweep touches the same files Task 3 edits), and 4 must precede 5 (Task 5 depends on `--surface-raised` existing). Task 6 follows 4 so `--color-hairline` already exists in the theme block.
