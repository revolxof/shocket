// @ts-check

import eslint from "@eslint/js"
import { defineConfig } from "eslint/config"
import tseslint from "typescript-eslint"
import stylistic from "@stylistic/eslint-plugin"

export default defineConfig(
  eslint.configs.recommended,
  tseslint.configs.strictTypeChecked,
  tseslint.configs.stylisticTypeChecked,
  {
    plugins: {
      "@stylistic": stylistic
    },
    rules: {
      "@typescript-eslint/restrict-template-expressions": "off",
      "@stylistic/indent": ["error", 2],
      "@stylistic/semi": ["error", "never"],
      "@stylistic/comma-dangle": ["error", "always-multiline"],
      "@stylistic/quotes": ["error", "double"],
      "@stylistic/eol-last": ["error", "always"],
    },
    languageOptions: {
      parserOptions: {
        projectService: true
      },
    },
  }
);
