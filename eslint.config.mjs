import { defineConfig, globalIgnores } from "eslint/config";
import globals from "globals";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "public/play/snowflow/**",
    "games/snowflow/tests/**",
  ]),
  // The game is plain browser JavaScript with no React. It gets one rule that
  // matters more there than anywhere else: a name that is used but never
  // defined. `node --check` cannot see that, the bundler will not stop for
  // it, and it surfaces at runtime as a broken button.
  {
    files: ["games/snowflow/src/**/*.js"],
    languageOptions: {
      sourceType: "module",
      globals: { ...globals.browser, ...globals.es2022 },
    },
    rules: {
      "no-undef": "error",
      "no-unused-vars": ["warn", { args: "none", caughtErrors: "none" }],
      // The TypeScript preset reaches these files too; one report per name is enough.
      "@typescript-eslint/no-unused-vars": "off",
    },
  },
]);

export default eslintConfig;
