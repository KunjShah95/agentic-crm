/*
 * Generates `public/llms.txt` and `public/llms-full.txt` from
 * `content/marketing.ts` and `content/llms-txt.ts`.
 *
 * ## Why a build step instead of route handlers
 *
 * Both files already existed as static assets in `public/`. A route handler at
 * the same path is a hard build error in Next — "a conflicting public file and
 * page file was found" — and the static file wins at runtime anyway, so a
 * handler would have looked correct in dev and served the stale copy in
 * production. One source, one output.
 *
 * Static is also the right shape here. `llms.txt` is a plain markdown document,
 * not an application: nothing about it is tenant-specific or per-request, and a
 * crawler will fetch it far more often than it will fetch the site. Serving it
 * from the CDN as a static file is both faster and impossible to break at
 * runtime.
 *
 * ## Running it
 *
 * `npm run seo:llms` — and it is wired into `prebuild`, so a change to the
 * keyword source cannot ship without regenerating both files.
 */

import { writeFileSync } from "node:fs"
import path from "node:path"
import { llmsTxt, llmsFullTxt } from "../content/llms-txt"

const root = path.resolve(__dirname, "..")
const outDir = path.join(root, "public")

const outputs: [string, string][] = [
  ["llms.txt", llmsTxt()],
  ["llms-full.txt", llmsFullTxt()],
]

for (const [name, contents] of outputs) {
  const target = path.join(outDir, name)
  writeFileSync(target, contents, "utf8")
  // Word count rather than byte count: what matters is whether the file stays
  // small enough to sit in a context window whole, which is the entire point
  // of the short form.
  console.log(
    `${name.padEnd(14)} ${String(contents.length).padStart(6)} bytes  ${String(
      contents.split(/\s+/).length
    ).padStart(5)} words`
  )
}
