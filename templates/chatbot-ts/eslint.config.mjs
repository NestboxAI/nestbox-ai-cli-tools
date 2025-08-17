import tsParser from "@typescript-eslint/parser";
import eslintPluginTs from "@typescript-eslint/eslint-plugin";

export default [
  {
    files: ["**/*.ts"],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: "latest",
        sourceType: "module",
      },
    },
    plugins: {
      "@typescript-eslint": eslintPluginTs,
    },
    rules: {
      ...eslintPluginTs.configs.recommended.rules,
      // Optional custom rules:
      // '@typescript-eslint/no-explicit-any': 'warn',
      // '@typescript-eslint/explicit-function-return-type': 'off',
    },
  },
  {
    ignores: ["dist/", "node_modules/"],
  },
];
