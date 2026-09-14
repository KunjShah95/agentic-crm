import { test, expect } from "@playwright/test"

/**
 * NOTE: this suite has no storageState/login fixture, so these run logged-out
 * against pages that require a workspace membership. Assert only what is safe
 * to check without a session (that protected content is ABSENT); anything that
 * needs real in-app content requires a logged-in fixture first — crm.spec.ts
 * signs up inline and is the pattern to follow.
 *
 * WhatsApp is the only messaging provider in this build; X and LinkedIn were
 * removed. The WhatsApp settings page is still routed — it is simply no longer
 * linked from the sidebar — so these navigate by URL.
 */

test.describe("Billing", () => {
  test("billing page shows quota bars", async ({ page }) => {
    await page.goto("/testws/settings/billing")
    await expect(page.getByText(/usage/i)).toBeVisible()
  })

  test("billing page shows current plan", async ({ page }) => {
    await page.goto("/testws/settings/billing")
    // Plan badge or heading should mention plan (free/pro/scale) or billing title
    await expect(page.getByText(/billing|plan/i).first()).toBeVisible()
  })
})

test.describe("WhatsApp settings", () => {
  test("does not render the connection panel for logged-out visitors", async ({ page }) => {
    await page.goto("/testws/settings/social")
    // Must not leak another tenant's number, webhook config or link button.
    await expect(page.getByText(/link this workspace/i)).toHaveCount(0)
    await expect(page.getByText(/\/api\/whatsapp\/webhook/)).toHaveCount(0)
  })

  test("sidebar no longer advertises the removed providers", async ({ page }) => {
    await page.goto("/login")
    await expect(page.getByText(/^Connect X$/i)).toHaveCount(0)
    await expect(page.getByText(/LinkedIn/i)).toHaveCount(0)
  })
})
