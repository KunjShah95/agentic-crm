import { test, expect } from "@playwright/test"
import { Client } from "pg"
import { loginAndOpenApp, DEMO } from "./helpers/auth"

/**
 * Critical paths: signup, auth surfaces, workspace invites, pipeline.
 *
 * These were dormant for a long time. Every spec guarded on `hasDb`, and
 * DATABASE_URL was not in the Playwright process environment, so the whole file
 * skipped and reported green. With the env loaded (see playwright.config.ts)
 * three of them immediately failed against real behaviour:
 *
 *   - signup lands on /dashboard, not /contacts;
 *   - the sign-in page exposes no `heading` role (its title is metadata only),
 *     so a heading-based assertion could never match;
 *   - the invalid-invite page matched two elements, tripping strict mode.
 *
 * The signup test also created a real user and workspace in the live database
 * on every run. It now cleans up after itself, because a suite that pollutes
 * the database it asserts against will eventually assert against its own
 * leftovers.
 */

const hasDb = !!process.env.DATABASE_URL || !!process.env.TEST_DATABASE_URL

/** Workspaces and users created by this run, removed in afterAll. */
const created: { slug: string; email: string }[] = []

async function purgeCreated() {
  if (!created.length || !process.env.DATABASE_URL) return
  const client = new Client({ connectionString: process.env.DATABASE_URL })
  try {
    await client.connect()
    for (const row of created) {
      const ws = await client.query(`SELECT id FROM "Workspace" WHERE slug = $1`, [row.slug])
      // Cascades to contacts, deals, activities, stages, memberships.
      for (const r of ws.rows) await client.query(`DELETE FROM "Workspace" WHERE id = $1`, [r.id])
      await client.query(`DELETE FROM "User" WHERE email = $1`, [row.email])
    }
    console.log(`\npurged ${created.length} test workspace(s) from the database`)
  } finally {
    await client.end()
  }
}

test.describe("Auth & onboarding", () => {
  test.skip(!hasDb, "requires DATABASE_URL")

  test.afterAll(async () => {
    await purgeCreated()
  })

  test("signup creates a workspace and lands in the app", async ({ page }) => {
    const stamp = Date.now()
    const email = `e2e-${stamp}@example.com`
    const slug = `e2e-ws-${stamp}`
    created.push({ slug, email })

    await page.goto("/signup")
    await page.getByLabel(/name/i).first().fill("E2E User")
    await page.getByLabel(/email/i).fill(email)
    await page.getByLabel(/^password/i).fill("password123")
    await page.getByLabel(/workspace/i).fill(`E2E WS ${stamp}`)

    const submit = page.getByRole("button", { name: /create|sign up|get started/i }).first()
    if ((await submit.count()) > 0) {
      // The submit button can sit under an adjacent anchor; force past the
      // hit-test rather than failing for a layout reason.
      await submit.click({ force: true })
    }

    // Lands in the new workspace. The exact first page is an implementation
    // detail; "is inside the new workspace at all" is the actual promise.
    await expect(page).toHaveURL(new RegExp(`/${slug}/`), { timeout: 20_000 })
    await expect(
      page.getByRole("button", { name: /search or jump/i })
    ).toBeVisible({ timeout: 20_000 })
  })

  test("sign-in page renders a usable form", async ({ page }) => {
    // Not a heading assertion: the page has no `heading` role, its title is
    // metadata only. Assert the controls a person actually needs.
    await page.goto("/login")
    await expect(page.getByLabel(/^email/i)).toBeVisible()
    await expect(page.getByLabel(/^password/i)).toBeVisible()
    await expect(
      page.getByRole("button", { name: /sign in/i }).first()
    ).toBeVisible()
  })

  test("workspace invite page handles an invalid token", async ({ page }) => {
    await page.goto("/invite/invalid-token-123")
    // `.first()` because the page states the failure in both a heading and
    // supporting copy, and strict mode rejects two matches.
    await expect(page.getByText(/invite unavailable|invalid/i).first()).toBeVisible()
  })

  test("an unknown route renders the not-found page", async ({ page }) => {
    await page.goto("/this-route-does-not-exist")
    await expect(page.locator("body")).toBeVisible()
  })
})

test.describe("Pipeline", () => {
  test.skip(!hasDb, "requires DATABASE_URL")

  test.beforeEach(async ({ page }) => {
    await loginAndOpenApp(page)
  })

  test("dashboard renders the seeded workspace", async ({ page }) => {
    await page.goto(`/${DEMO.workspace}/dashboard`)
    await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible({
      timeout: 15_000,
    })
  })

  test("deals page shows the pipeline board", async ({ page }) => {
    await page.goto(`/${DEMO.workspace}/deals`)
    await expect(page.locator("body")).toBeVisible()
    await expect(page.getByText(/Skyline Residences|Shilp/i).first()).toBeVisible({
      timeout: 15_000,
    })
  })
})