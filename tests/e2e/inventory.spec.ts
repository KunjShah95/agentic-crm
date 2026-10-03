import { test, expect } from "@playwright/test"
import { loginAndOpenApp, DEMO } from "./helpers/auth"

/**
 * Inventory: the seeded Shilp Infra workspace carries three projects
 * (Skyline Residences, Shilp Serenity, Shilp Heights) and a tower/floor/unit
 * tree, so this asserts real rows rather than an empty shell.
 *
 * This previously navigated to a protected page with no session and asserted a
 * heading — which "passed" only because the whole suite skipped.
 */
test.describe("Inventory", () => {
  test.beforeEach(async ({ page }) => {
    await loginAndOpenApp(page)
  })

  test("projects list shows the seeded projects", async ({ page }) => {
    await page.goto(`/${DEMO.workspace}/projects`)
    await expect(page.getByRole("heading", { name: /projects/i }).first()).toBeVisible()
    await expect(page.getByText("Skyline Residences").first()).toBeVisible()
    await expect(page.getByText("Shilp Serenity").first()).toBeVisible()
  })

  test("a project exposes its units", async ({ page }) => {
    await page.goto(`/${DEMO.workspace}/projects`)
    const project = page.getByText("Skyline Residences").first()
    await project.click()
    // Unit numbers come from the seed: A-1201, A-1202, A-1203 on Tower A.
    await expect(page.getByText(/A-120\d/).first()).toBeVisible({ timeout: 15_000 })
  })
})