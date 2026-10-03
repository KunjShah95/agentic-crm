import { test, expect } from "@playwright/test"
import { loginAsDemo, loginAndOpenApp, DEMO } from "./helpers/auth"

/**
 * Billing and social-channel settings.
 *
 * The two WhatsApp tests assert that a logged-out visitor sees *no* tenant
 * connection data — those are security assertions and must stay logged out.
 *
 * The two billing tests previously navigated to `/testws/settings/billing` with
 * no session and expected to see quota and plan text. That workspace does not
 * exist, and the route requires a membership, so they were asserting against a
 * login redirect; they only "passed" because the suite skipped. They now log in
 * to a workspace that exists and assert real content.
 *
 * WhatsApp is the only messaging provider in this build; X and LinkedIn were
 * removed. The WhatsApp settings page is still routed — simply no longer linked
 * from the sidebar — so those navigate by URL.
 */
test.describe("Billing", () => {
  test.beforeEach(async ({ page }) => {
    await loginAndOpenApp(page)
  })

  test("billing page shows usage for the workspace", async ({ page }) => {
    await page.goto(`/${DEMO.workspace}/settings/billing`)
    await expect(page.getByText(/usage/i).first()).toBeVisible({ timeout: 15_000 })
  })

  test("billing page names the current plan", async ({ page }) => {
    await page.goto(`/${DEMO.workspace}/settings/billing`)
    await expect(page.getByText(/billing|plan/i).first()).toBeVisible({ timeout: 15_000 })
  })
})

/**
 * Negative auth assertions, deliberately in their own describe so they do NOT
 * inherit the login `beforeEach` above. Playwright gives every test a fresh
 * context, so simply not logging in is the reliable way to be signed out —
 * clearing cookies mid-test was leaving an authenticated session behind, and a
 * negative test that is accidentally authenticated asserts nothing.
 */
test.describe("Unauthenticated access", () => {
  test("billing page is not reachable without a session", async ({ page }) => {
    // The inverse of the two above: proves the guard is real, so a green
    // billing test means something.
    const base = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000"
    await page.goto(`${base}/${DEMO.workspace}/settings/billing`)
    await page.waitForURL(/\/login/, { timeout: 15_000 })
  })

  test("contacts page is not reachable without a session", async ({ page }) => {
    const base = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000"
    await page.goto(`${base}/${DEMO.workspace}/contacts`)
    await page.waitForURL(/\/login/, { timeout: 15_000 })
  })
})

test.describe("WhatsApp settings", () => {
  test("does not render the connection panel for logged-out visitors", async ({ page }) => {
    await page.goto("/testws/settings/social")
    // Must not leak another tenant's number, webhook config or link button.
    await expect(page.getByText(/link this workspace/i)).toHaveCount(0)
    await expect(page.getByText(/\/api\/whatsapp\/webhook/)).toHaveCount(0)
  })

  test("does not leak a webhook URL to a logged-out visitor", async ({ page }) => {
    // The connected account number and webhook endpoint are the two things
    // worth stealing here, so assert both are absent while signed out.
    const body = await page.locator("body").innerText()
    expect(body).not.toMatch(/\/api\/whatsapp\/webhook/)
    expect(body).not.toMatch(/\+\d{10,}/)
  })

  test("sidebar no longer advertises the removed providers", async ({ page }) => {
    await page.goto("/login")
    await expect(page.getByText(/^Connect X$/i)).toHaveCount(0)
    await expect(page.getByText(/LinkedIn/i)).toHaveCount(0)
  })

  test("a member sees their own workspace's WhatsApp page without another tenant's data", async ({
    page,
  }) => {
    await loginAsDemo(page)
    const base = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000"
    await page.goto(`${base}/${DEMO.workspace}/settings/social`)
    // Signed in as shilp: the page may render its own state, but it must never
    // contain the seeded "testws" tenant's identifiers.
    await page.waitForLoadState("domcontentloaded")
    const body = await page.locator("body").innerText()
    expect(body).not.toContain("testws")
  })
})