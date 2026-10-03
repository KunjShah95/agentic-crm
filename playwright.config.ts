import { defineConfig, devices } from "@playwright/test"
import { config as loadEnv } from "dotenv"

// Load .env into the test process.
//
// Without this, DATABASE_URL is undefined here, every spec's `hasDb` guard is
// false, and the whole e2e suite skips — reporting green while testing nothing.
// That is how three real defects in ⌘K search shipped: the suite's only search
// test asserted a <body> was visible, and it was never even running.
loadEnv({ path: ".env" })
loadEnv({ path: ".env.local", override: true })

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 30_000,
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: "npm run dev",
    url: "http://localhost:3000/api/auth/providers",
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
    env: {
      DATABASE_URL: process.env.DATABASE_URL ?? "",
      AUTH_SECRET: process.env.AUTH_SECRET ?? "test-secret-playwright",
      NEXTAUTH_URL: "http://localhost:3000",
    },
  },
})
