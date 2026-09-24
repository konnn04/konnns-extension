import js from "@eslint/js";
import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";
import globals from "globals";

export default tseslint.config(
  // Generated / build output — never lint
  {
    ignores: [
      ".wxt/**",
      ".output/**",
      "node_modules/**",
      "dist/**",
      "**/*.d.ts",
      // vendored third-party assets self-hosted for CSP/no-CDN reasons
      // (docs/roadmap/00-tong-quan.md §2.7) — not our source, never lint them
      "public/**",
    ],
  },

  js.configs.recommended,
  ...tseslint.configs.recommended,

  // Extension source (browser + webextension globals + React Hooks rules)
  {
    files: ["src/**/*.{ts,tsx}"],
    languageOptions: {
      globals: { ...globals.browser, ...globals.webextensions },
    },
    plugins: { "react-hooks": reactHooks },
    rules: {
      ...reactHooks.configs.recommended.rules,
      // exhaustive-deps is advisory here (some effects intentionally omit deps)
      "react-hooks/exhaustive-deps": "warn",
      // allow intentionally-unused args/vars prefixed with _
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_", caughtErrors: "none" },
      ],
      "@typescript-eslint/no-explicit-any": "warn",
    },
  },

  // "1 tool = 1 folder" — docs/site/00 §2. Inside a tool you reach your own
  // files with relative paths, so an `@/features/...` specifier HERE is by
  // definition a reach into somebody else's tool: the thing that turns a folder
  // you can delete into a folder you cannot. Shared code is promoted to
  // @/core or @/shared instead.
  //
  // src/features/newtab predates the convention and still has a few of these,
  // so it is deliberately left out rather than bulk-rewritten.
  {
    files: [
      "src/features/site/**/*.{ts,tsx}",
      "src/features/embed/**/*.{ts,tsx}",
      "src/features/popup/**/*.{ts,tsx}",
    ],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@/features/**"],
              message:
                "A tool must not import another tool. Use a relative path within your own folder, or move the shared part to @/core or @/shared.",
            },
          ],
        },
      ],
    },
  },

  // Node-side files (configs, CI scripts)
  {
    files: ["*.{js,ts,mjs,cjs}", ".github/**/*.{js,mjs,cjs}"],
    languageOptions: {
      globals: { ...globals.node },
    },
  },
);
