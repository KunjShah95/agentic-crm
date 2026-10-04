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

  {
    rules: {
      /**
       * Honour the `_` prefix as "deliberately unused".
       *
       * The convention is already used throughout this codebase — `_args` on
       * vitest mock stubs that only need to return a value, `_role` on a
       * signature kept for symmetry with a sibling function, `_key` where the
       * map callback's key is genuinely irrelevant. None of those were mistakes,
       * and the rule as configured flagged every one of them, which is how
       * `authz-regressions.test.ts` alone accumulated thirteen warnings for a
       * dozen perfectly good mock definitions.
       *
       * The alternative is deleting the parameter names, which loses the
       * documentation value of naming them. The underscore *is* the documentation.
       *
       * `caughtErrors: "none"` because a bare `catch {}` is idiomatic and an
       * unused binding in one is not a finding.
       */
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          destructuredArrayIgnorePattern: "^_",
          caughtErrors: "none",
        },
      ],
    },
  },
]);

export default eslintConfig;
