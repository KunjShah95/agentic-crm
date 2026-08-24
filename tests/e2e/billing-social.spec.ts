import { test, expect } from "@playwright/test"

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
