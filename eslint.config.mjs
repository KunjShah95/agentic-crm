import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",

    // Tooling directories. `.kilo/worktrees` in particular holds full copies of
    // this repository created by the Kilo agent runtime, so linting it reported
    // the same code two or three more times over — 83 of the 166 errors in a
    // repo-wide run were duplicates of files that also exist in `modules/`.
    // None of this is project source: it is agent config, prompts and skills.
    ".kilo/**",
    ".agents/**",
    ".claude/**",
    ".superpowers/**",
    ".playwright-mcp/**",
    ".qodo/**",
    "playwright-report/**",
    "test-results/**",
    "coverage/**",
    "node_modules/**",
  ]),
]);

export default eslintConfig;
