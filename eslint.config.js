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

  // Node-side files (configs, CI scripts)
  {
    files: ["*.{js,ts,mjs,cjs}", ".github/**/*.{js,mjs,cjs}"],
    languageOptions: {
      globals: { ...globals.node },
    },
  },
);
