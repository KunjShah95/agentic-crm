import fs from "node:fs"
import path from "node:path"

export const REPO_ROOT = path.resolve(__dirname, "..", "..")

/** Vendored shadcn and the Phase 4 marketing tree are deliberately excluded. */
const COMPONENT_EXCLUDES = new Set(["ui", "landing"])

function componentDirs(): string[] {
  const root = path.join(REPO_ROOT, "components")
  if (!fs.existsSync(root)) return []
  return fs
    .readdirSync(root, { withFileTypes: true })
    .filter((e) => e.isDirectory() && !COMPONENT_EXCLUDES.has(e.name))
    .map((e) => `components/${e.name}`)
    .sort()
}

export const APP_DIRS = [
  "app/(app)",
  "app/(auth)",
  "app/buyer",
  "app/invite",
  "app/not-found.tsx",
] as const

export const SCOPE: readonly string[] = [...APP_DIRS, ...componentDirs()]

export const EXCLUDED = [
  "components/ui (vendored shadcn)",
  "components/landing (Phase 4)",
  "app/(marketing) (Phase 4)",
  "app/(public)",
  "app/api",
] as const

/** A line whose first non-space characters open a comment. */
const COMMENT_LINE = /^\s*(\/\/|\/\*|\*|\{?\/\*)/

const TSX = /\.tsx?$/

/** Collects .ts/.tsx files under a scope entry, which may be a file or a dir. */
function walk(entry: string, out: string[] = []): string[] {
  const abs = path.join(REPO_ROOT, entry)
  if (!fs.existsSync(abs)) {
    throw new Error(
      `source-scan: scope entry not found: "${entry}" (looked in ${abs})`
    )
  }
  if (fs.statSync(abs).isFile()) {
    if (TSX.test(abs)) out.push(abs)
    return out
  }
  for (const child of fs.readdirSync(abs, { withFileTypes: true })) {
    const full = path.join(abs, child.name)
    if (child.isDirectory()) walk(path.relative(REPO_ROOT, full), out)
    else if (TSX.test(child.name)) out.push(full)
  }
  return out
}

export type Violation = { file: string; line: number; match: string; text: string }

export type ScanOptions = {
  roots?: readonly string[]
  includeComments?: boolean
}

const CONTEXT_BEFORE = 40
const CONTEXT_AFTER = 60

/** Line excerpt centered on the match, so long className lines stay legible. */
function excerpt(text: string, index: number): string {
  const start = Math.max(0, index - CONTEXT_BEFORE)
  const end = Math.min(text.length, index + CONTEXT_AFTER)
  const lead = start > 0 ? "…" : ""
  const tail = end < text.length ? "…" : ""
  return `${lead}${text.slice(start, end).trim()}${tail}`
}

export function scan(
  pattern: RegExp,
  options: ScanOptions = {}
): Violation[] {
  const { roots = SCOPE, includeComments = false } = options
  // Copy the pattern so the caller's regex is never mutated, and drop the
  // stateful flags so lastIndex cannot leak between per-line exec() calls.
  const re = new RegExp(pattern.source, pattern.flags.replace(/[gy]/g, ""))
  const found: Violation[] = []
  for (const root of roots) {
    for (const file of walk(root)) {
      fs.readFileSync(file, "utf8")
        .split(/\r?\n/)
        .forEach((line, i) => {
          if (!includeComments && COMMENT_LINE.test(line)) return
          const m = re.exec(line)
          if (!m) return
          found.push({
            file: path.relative(REPO_ROOT, file).replace(/\\/g, "/"),
            line: i + 1,
            match: m[0],
            text: excerpt(line, m.index),
          })
        })
    }
  }
  return found.sort(
    (a, b) => (a.file < b.file ? -1 : a.file > b.file ? 1 : a.line - b.line)
  )
}

const MAX_SHOWN = 25

function ordinalSuffix(n: number): string {
  const mod100 = n % 100
  if (mod100 >= 11 && mod100 <= 13) return "th"
  switch (n % 10) {
    case 1:
      return "st"
    case 2:
      return "nd"
    case 3:
      return "rd"
    default:
      return "th"
  }
}

/**
 * Central assertion for every conformance suite. Samples across the whole
 * scope rather than truncating the head, so a fix in a late-alphabet tree is
 * always visible in the output.
 */
export function expectNoViolations(v: Violation[], label: string): void {
  if (v.length === 0) return
  const files = new Set(v.map((x) => x.file))
  const stride = Math.max(1, Math.ceil(v.length / MAX_SHOWN))
  const sampled = v.filter((_, i) => i % stride === 0).slice(0, MAX_SHOWN)
  const lines = sampled.map(
    (x) => `  ${x.file}:${x.line}  [${x.match}]  ${x.text}`
  )
  if (v.length > sampled.length) {
    lines.push(
      `  ...${v.length - sampled.length} more across ${files.size} files (showing every ${stride}${ordinalSuffix(stride)})`
    )
  }
  throw new Error(
    `${label}: ${v.length} violation(s) in ${files.size} file(s)\n${lines.join("\n")}`
  )
}

export function css(): string {
  return fs.readFileSync(path.join(REPO_ROOT, "app/globals.css"), "utf8")
}
