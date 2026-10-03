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
    // The suite transforms the Prisma client and the whole server-action graph
    // on first import, which on a cold Windows cache costs more than vitest's
    // 5s default. These are import-time costs, not slow assertions — raising
    // the ceiling keeps the tests honest instead of letting a timeout masquerade
    // as a logic failure.
    testTimeout: 30_000,
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
