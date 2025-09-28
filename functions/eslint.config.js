import js from "@eslint/js";
import tseslint from "@typescript-eslint/eslint-plugin";
import tsparser from "@typescript-eslint/parser";
import importPlugin from "eslint-plugin-import";
import prettierConfig from "eslint-config-prettier";
import googleConfig from "eslint-config-google";

export default [
  // Apply Google style config so tools won't miss eslint-config-google
  googleConfig,
  // Base recommended JS rules
  js.configs.recommended,
  // Turn off formatting rules that conflict with Prettier
  prettierConfig,
  {
    files: ["**/*.ts", "**/*.tsx", "**/*.js", "**/*.jsx"],
    plugins: {
      "@typescript-eslint": tseslint,
      import: importPlugin,
    },
    languageOptions: {
      parser: tsparser,
      parserOptions: {
        ecmaVersion: 2022,
        sourceType: "module",
        // Resolve TS project files relative to functions/ folder
        project: ["./tsconfig.json", "./tsconfig.dev.json"],
      },
    },
    settings: {
      // ...add project-specific settings here if needed...
    },
    rules: {
      // Preserve previous rule choices from .eslintrc.js
      "quotes": ["error", "double"],
      "import/no-unresolved": "off",
      "indent": ["error", 2],

      // TypeScript plugin rule parity (keep defaults or adjust as needed)
      // ...existing code...
    },
  },
  {
    ignores: [
      "/lib/**", // Ignore built files.
      "/generated/**", // Ignore generated files.
    ],
  },
];