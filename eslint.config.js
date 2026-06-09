// @ts-check
const tseslint = require("@typescript-eslint/eslint-plugin");
const tsParser = require("@typescript-eslint/parser");
const reactPlugin = require("eslint-plugin-react");
const reactHooksPlugin = require("eslint-plugin-react-hooks");
const importPlugin = require("eslint-plugin-import");
const prettierConfig = require("eslint-config-prettier");

/** @type {import("eslint").Linter.Config[]} */
module.exports = [
  {
    ignores: [
      "**/node_modules/**",
      "**/dist/**",
      "**/build/**",
      "**/.next/**",
      "**/android/**",
      "**/ios/**",
    ],
  },
  // TypeScript rules for all packages
  {
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: "latest",
        sourceType: "module",
        ecmaFeatures: { jsx: true },
      },
    },
    plugins: {
      "@typescript-eslint": tseslint,
      import: importPlugin,
    },
    rules: {
      ...tseslint.configs.recommended.rules,
      "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
      "import/order": ["warn", { "newlines-between": "always", alphabetize: { order: "asc" } }],
    },
  },
  // React rules scoped to app packages only
  {
    files: ["apps/**/*.{ts,tsx,js,jsx}"],
    plugins: {
      react: reactPlugin,
      "react-hooks": reactHooksPlugin,
    },
    rules: {
      ...reactPlugin.configs.recommended.rules,
      ...reactHooksPlugin.configs.recommended.rules,
      "react/react-in-jsx-scope": "off",
    },
    settings: {
      react: { version: "detect" },
    },
  },
  prettierConfig,
];
