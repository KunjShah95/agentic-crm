import { test, expect } from "@playwright/test"

test("projects → inventory → cost sheet", async ({ page }) => {
  await page.goto("/shilp/projects")
  await expect(page.getByText("Projects")).toBeVisible()
})
