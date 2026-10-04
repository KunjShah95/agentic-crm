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
    /*
     * Worker count is capped by MEMORY, not by CPU.
     *
     * Vitest's default pool is `forks` at `availableParallelism() - 1`. On a
     * 24-core dev box that is 23 concurrent Node processes, and each one pays
     * for a jsdom environment plus the transformed Prisma/server-action graph.
     * That is roughly 400MB per worker, so the pool exhausts RAM long before it
     * finishes and workers die during startup:
     *
     *   "Failed to start forks worker for test files ..."
     *   "Timeout waiting for worker to respond"
     *
     * The symptom is badly misleading — a full `npm test` reported
     * "9 passed | 1 skipped (10)" out of 56 files with 46 pool errors, which
     * reads like a catastrophically broken suite. Nothing was broken. Capped at
     * 2 workers the same 56 files run 364 passing tests in ~105s.
     *
     * Raise this on a machine that can afford it; the suite is correct either
     * way, and this is only here so the default `npm test` actually runs.
     */
    pool: "forks",
    maxWorkers: 2,
    fileParallelism: false,
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
