import type { Page } from "@playwright/test"

/**
 * Shared authenticated session for the e2e suite.
 *
 * Until now every spec either skipped without a DATABASE_URL or navigated
 * straight to a protected page with no session, so they either never ran or
 * asserted on a login redirect. This logs in through the NextAuth credentials
 * endpoint rather than driving the sign-in form:
 *
 *   - The form is styled dynamically and its submit button has been observed
 *     partially covered by an adjacent anchor, which makes UI login flaky for
 *     reasons that have nothing to do with the behaviour under test.
 *   - It removes a class of "failed because the button moved" noise.
 *
 * The session cookie is shared with the page context, so the caller can just
 * navigate afterwards.
 */

export const DEMO = {
  email: "demo@estate360.com",
  password: "password123",
  workspace: "shilp",
} as const

export async function loginAsDemo(page: Page): Promise<void> {
  const base = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000"
  const csrfRes = await page.request.get(`${base}/api/auth/csrf`)
  const { csrfToken } = (await csrfRes.json()) as { csrfToken: string }
  await page.request.post(`${base}/api/auth/callback/credentials`, {
    form: {
      csrfToken,
      email: DEMO.email,
      password: DEMO.password,
      callbackUrl: `${base}/${DEMO.workspace}/dashboard`,
    },
  })
}

/** Log in and land on the dashboard, asserting the session actually took. */
export async function loginAndOpenApp(page: Page): Promise<void> {
  await loginAsDemo(page)
  const base = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000"
  await page.goto(`${base}/${DEMO.workspace}/dashboard`, { waitUntil: "domcontentloaded" })
  await page.waitForURL(new RegExp(`/${DEMO.workspace}/`))
  // The ⌘K trigger is in the server-rendered HTML, so its presence proves the
  // shell mounted but not that React hydrated. Clicking it proves both.
  await page.getByRole("button", { name: /search or jump/i }).click()
  await page.waitForSelector("[cmdk-input]", { timeout: 15_000 })
  await page.keyboard.press("Escape")
}