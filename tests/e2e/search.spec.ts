import { test, expect } from "@playwright/test"

/**
 * Global search (⌘K) regression coverage.
 *
 * This file exists because search was broken in three separate ways at once and
 * nothing caught it: the e2e suite's only "search" test asserted that a <body>
 * was visible, and the unit test mocked the database, so the SQL could not fail
 * and the palette could not hang. Both defects shipped.
 *
 * The three, all found by driving the real palette against the seeded DB:
 *
 * 1. A trailing space wedged the palette on "Searching…" forever. The stale-
 *    response guard compared the *trimmed* query against the *raw* one, so the
 *    callback bailed before writing results and before clearing the spinner.
 * 2. Partial words did not match. plainto_tsquery matches whole lexemes only,
 *    so "anj" found nothing while "anjali" worked.
 * 3. Phone was not searchable at all — and then, after being added, only in
 *    its +91 form, so the number as written on a visiting card still missed.
 *
 * Requires a seeded database (npm run db:seed) — the fixtures are the seeded
 * Shilp Infra workspace.
 */

const BASE = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000"
const hasDb = !!process.env.DATABASE_URL || !!process.env.TEST_DATABASE_URL

/** Log in through the NextAuth endpoint: the login form is styled dynamically. */
async function login(page: import("@playwright/test").Page) {
  const csrf = await page.request.get(`${BASE}/api/auth/csrf`)
  const { csrfToken } = (await csrf.json()) as { csrfToken: string }
  await page.request.post(`${BASE}/api/auth/callback/credentials`, {
    form: {
      csrfToken,
      email: "demo@estate360.com",
      password: "password123",
      callbackUrl: `${BASE}/shilp/dashboard`,
    },
  })
  await page.goto(`${BASE}/shilp/dashboard`, { waitUntil: "domcontentloaded" })
  await expect(page).toHaveURL(/\/shilp\//)
  // Wait for the hydrated trigger, not a fixed sleep. The ⌘K listener is
  // attached on mount, so pressing the shortcut before React hydrates silently
  // does nothing and the test fails for a reason that has nothing to do with
  // search.
  await expect(page.getByRole("button", { name: /search or jump/i })).toBeVisible()
}

/**
 * Open the palette with the keyboard, retrying until hydration has attached the
 * document-level ⌘K listener.
 *
 * Waiting for the trigger button to be *visible* is not enough: it is in the
 * server-rendered HTML, so it appears before React hydrates, and a shortcut
 * pressed in that window silently does nothing. Pressing until the input
 * actually exists tests the thing we care about — that the shortcut works —
 * instead of a proxy for it.
 */
async function openPalette(page: import("@playwright/test").Page) {
  for (let attempt = 0; attempt < 20; attempt++) {
    await page.keyboard.press("Control+k")
    if ((await page.locator("[cmdk-input]").count()) > 0) return
    await page.waitForTimeout(250)
  }
  throw new Error("⌘K never opened the palette — the shortcut listener is not attached")
}

/** Type into the palette and return the rendered rows. */
async function search(page: import("@playwright/test").Page, term: string) {
  await openPalette(page)
  const input = page.locator("[cmdk-input]")
  await input.fill("")
  await input.type(term, { delay: 40 })
  // Generous: under `next dev` the first search of a session pays on-demand
  // compilation of the server action, which can take several seconds.
  await page.waitForTimeout(2500)
  const items = (await page.locator("[cmdk-item]").allInnerTexts()).map((t) =>
    t.replace(/\s+/g, " ").trim()
  )
  const text = await page.locator("[cmdk-root]").last().innerText()
  await page.keyboard.press("Escape")
  await page.waitForTimeout(400)
  return { items, text }
}

test.describe("global search (⌘K)", () => {
  test.skip(!hasDb, "requires a seeded DATABASE_URL")

  test.beforeEach(async ({ page }) => {
    await login(page)
  })

  test("matches a whole name", async ({ page }) => {
    const { items } = await search(page, "anjali")
    expect(items.join(" ")).toContain("Anjali Trivedi")
  })

  test("matches a prefix of a word", async ({ page }) => {
    // The regression: previously only whole lexemes matched, so a partial word
    // silently returned nothing.
    const { items } = await search(page, "anj")
    expect(items.join(" ")).toContain("Anjali Trivedi")
  })

  test("does not wedge when the query has surrounding whitespace", async ({ page }) => {
    // The regression: the stale-response guard compared trimmed against raw, so
    // a trailing space left the palette spinning on "Searching…" forever.
    const { items, text } = await search(page, "anjali ")
    expect(items.join(" ")).toContain("Anjali Trivedi")
    expect(text).not.toMatch(/Searching…/i)
  })

  test("finds a contact by the phone number as written", async ({ page }) => {
    // Seeded fixture: Rohan Mehta is +91 98250 12345. Both the national form
    // and the full international form must find him.
    const national = await search(page, "98250")
    expect(national.items.join(" ")).toContain("Rohan Mehta")

    const full = await search(page, "9825012345")
    expect(full.items.join(" ")).toContain("Rohan Mehta")
  })

  test("reports no matches rather than spinning", async ({ page }) => {
    const { text } = await search(page, "zzzznotathing")
    expect(text).toMatch(/No matches/i)
    expect(text).not.toMatch(/Searching…/i)
  })

  test("opens and closes with the keyboard without wedging", async ({ page }) => {
    await openPalette(page)
    await expect(page.locator("[cmdk-input]")).toBeVisible()
    await page.keyboard.press("Control+k")
    await expect(page.locator("[cmdk-input]")).toHaveCount(0)
  })
})