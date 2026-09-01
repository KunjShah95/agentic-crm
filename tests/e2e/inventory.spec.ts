import { test, expect } from "@playwright/test"

test("projects → inventory → cost sheet", async ({ page }) => {
  await page.goto("/acme/projects")
  await expect(page.getByText("Projects")).toBeVisible()
})
