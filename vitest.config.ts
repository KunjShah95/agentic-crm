import { defineConfig } from "vitest/config"
import path from "path"

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname),
    },
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./vitest.setup.ts"],
    include: ["tests/unit/**/*.test.{ts,tsx}", "tests/integration/**/*.test.{ts,tsx}"],
    env: {
      DATABASE_URL: "postgresql://test:test@localhost:5432/test",
      AUTH_SECRET: "test-secret",
    },
    coverage: {
      provider: "v8",
      reportsDirectory: "./coverage",
      include: ["lib/permissions.ts", "lib/format.ts", "lib/validators.ts"],
    },
  },
})
