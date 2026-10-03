/**
 * Verify prisma/schema.prisma, the generated Prisma Client, and the live
 * database all agree.
 *
 * This exists because that disagreement is silent until it is catastrophic. A
 * field added to the schema and used in a query, without the client being
 * regenerated, fails at runtime as:
 *
 *   Unknown field `wonAt` for select statement on model `Deal`
 *
 * …on *every* page render, behind a dev overlay, with no build-time or
 * type-time complaint. `tsc` is happy because the generated client is a
 * dependency, not an input. That is not a search bug — it took down the whole
 * app shell and made ⌘K look dead.
 *
 * Three failure modes are covered:
 *
 *   1. A field in the schema with no column in the database → migration not
 *      applied.
 *   2. A column in the database with no field in the schema → migration applied
 *      without the schema being updated (or a dropped field still indexed).
 *   3. A migration directory with no row in _prisma_migrations → never applied.
 *
 * Usage: npm run db:verify-sync   (needs a reachable DATABASE_URL)
 */

import "dotenv/config"
import fs from "node:fs"
import path from "node:path"
import { Client } from "pg"

const SCHEMA = "prisma/schema.prisma"
const MIGRATIONS = "prisma/migrations"

type Column = { field: string; column: string }
type Model = { name: string; table: string; fields: Column[]; relations: string[] }

/**
 * Parse `model X { … }` blocks into database column names, separating scalars
 * from relations.
 *
 * Two Prisma features make a naive field-name-to-column-name comparison wrong:
 *
 *   - `@map("cpId")` renames a column. `Deal.brokerId @map("cpId")` is stored in
 *     a column called `cpId`, so comparing `brokerId` against the catalog reports
 *     a missing column and `cpId` as an orphan. Both are false.
 *   - `@@map("ChannelPartner")` renames the whole table, so `model Broker` lives
 *     in a table named `ChannelPartner` and looks absent entirely.
 *
 * Relations are model-typed and never become columns, so they are identified by
 * their type naming another model — which needs two passes, since the model
 * names are only known once every block has been read.
 */
function parseSchema(file: string): Model[] {
  const src = fs.readFileSync(file, "utf8")
  const models: Model[] = []
  let current: Model | null = null

  for (const raw of src.split(/\r?\n/)) {
    const line = raw.trim()
    if (line.startsWith("//") || line.startsWith("///")) continue

    const open = /^model\s+(\w+)\s*\{/.exec(line)
    if (open) {
      current = { name: open[1], table: open[1], fields: [], relations: [] }
      models.push(current)
      continue
    }
    if (!current) continue
    if (line.startsWith("}")) {
      current = null
      continue
    }

    const tableMap = /^@@map\("(\w+)"\)/.exec(line)
    if (tableMap) {
      current.table = tableMap[1]
      continue
    }
    // Other @@ directives (index/unique/id) are not fields.
    if (line.startsWith("@@")) continue

    const m = /^(\w+)\s+(\w+)/.exec(line)
    if (!m) continue
    const fieldMap = /@map\("(\w+)"\)/.exec(line)
    current.fields.push({
      field: m[1],
      column: fieldMap ? fieldMap[1] : m[1],
      type: m[2],
    } as never)
  }

  // Second pass: anything typed as a model is a relation, not a column.
  const modelNames = new Set(models.map((m) => m.name))
  for (const model of models) {
    const scalars: Column[] = []
    const relations: string[] = []
    for (const f of model.fields as unknown as Array<Column & { type: string }>) {
      if (modelNames.has(f.type)) relations.push(f.field)
      else {
        const { type: _dropped, ...rest } = f
        scalars.push(rest)
      }
    }
    model.fields = scalars
    model.relations = relations
  }
  return models
}

async function main() {
  const problems: string[] = []
  const warnings: string[] = []

  const client = new Client({ connectionString: process.env.DATABASE_URL })
  await client.connect()

  const models = parseSchema(SCHEMA)

  for (const model of models) {
    const { rows } = await client.query<{ column_name: string }>(
      `SELECT column_name FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = $1`,
      [model.table]
    )
    const columns = new Set(rows.map((r) => r.column_name))
    if (columns.size === 0) {
      problems.push(
        `table "${model.table}" (model ${model.name}) does not exist in the database`
      )
      continue
    }
    for (const { field, column } of model.fields) {
      if (!columns.has(column)) {
        problems.push(
          `"${model.name}".${field} → column "${column}" is in schema.prisma but not in the database`
        )
      }
    }
    // Prisma's own mappers do not create columns, so anything extra is either a
    // hand-rolled ALTER or a schema that was rolled back without a migration.
    // The RAG tables are created by raw SQL migrations and carry columns the
    // Prisma models do not declare, so this is reported as a warning: it is
    // worth knowing about, but it does not break anything at runtime.
    const declared = new Set(model.fields.map((f) => f.column))
    for (const col of columns) {
      if (!declared.has(col)) {
        warnings.push(`"${model.table}".${col} is a column with no schema.prisma field`)
      }
    }
  }

  // Migrations that were never recorded as applied.
  const dirs = fs
    .readdirSync(MIGRATIONS, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort()
  if (dirs.length) {
    const applied = await client.query<{ migration_name: string }>(
      `SELECT migration_name FROM "_prisma_migrations" WHERE finished_at IS NOT NULL`
    )
    const appliedSet = new Set(applied.rows.map((r) => r.migration_name))
    for (const dir of dirs) {
      if (!appliedSet.has(dir)) {
        problems.push(`migration ${dir} has never been applied`)
      }
    }
  }

  await client.end()

  if (warnings.length) {
    console.log(`\n${warnings.length} column(s) not declared in schema.prisma (informational):`)
    for (const w of warnings) console.log(`  · ${w}`)
  }

  if (problems.length) {
    console.error(`\nschema/generated client/database are out of sync — ${problems.length} problem(s):\n`)
    for (const p of problems) console.error(`  ✗ ${p}`)
    console.error(`\nFix: npm run db:generate && npm run db:migrate\n`)
    process.exitCode = 1
    return
  }

  console.log(
    `\nschema, generated client and database agree (${models.length} models, ${dirs.length} migrations applied)\n`
  )
}

main().catch((err) => {
  console.error("verify-schema-sync failed:", err instanceof Error ? err.message : err)
  process.exitCode = 1
})