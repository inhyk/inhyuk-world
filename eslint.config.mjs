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
    "public/play/valorant/**",
    "public/play/blocktopia/**",
    "public/play/free-drive/**",
    "public/play/mineral-valley/**",
    "games/free-drive/public/models/draco/**",
    "public/play/deep-dig/**",
  ]),
  // The game is plain browser JavaScript with no React. It gets one rule that
  // matters more there than anywhere else: a name that is used but never
  // defined. `node --check` cannot see that, the bundler will not stop for
  // it, and it surfaces at runtime as a broken button.
  {
    files: ["games/mineral-valley/main.js", "games/mineral-valley/core.mjs", "games/mineral-valley/events.mjs", "games/mineral-valley/world.mjs", "games/snowflow/src/**/*.js", "games/valorant/src/**/*.{js,mjs}", "games/blocktopia/main.js", "games/free-drive/main.js", "games/free-drive/core.mjs", "games/free-drive/places.mjs", "games/free-drive/school.mjs", "games/free-drive/world.mjs", "games/free-drive/journey.mjs", "games/free-drive/law.mjs", "games/free-drive/police.mjs", "games/free-drive/online.mjs", "games/free-drive/room.mjs", "games/free-drive/ferrari.js", "games/deep-dig/main.js", "games/deep-dig/world.mjs", "games/deep-dig/core.mjs", "games/deep-dig/movement.mjs"],
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
  {
    files: ["public/play/mettaton/*.mjs", "public/play/orbit-breaker/*.mjs", "public/play/undertale/*.mjs"],
    languageOptions: {
      sourceType: "module",
      globals: { ...globals.browser, ...globals.es2022 },
    },
    rules: { "no-undef": "error" },
  },
]);

export default eslintConfig;
