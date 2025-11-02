import js from "@eslint/js";
import json from "@eslint/json";
import { defineConfig, globalIgnores } from "eslint/config";
import eslintConfigPrettier from "eslint-config-prettier";
import pluginImport from "eslint-plugin-import";
import jsxA11y from "eslint-plugin-jsx-a11y";
import prettier from "eslint-plugin-prettier";
import pluginReact from "eslint-plugin-react";
import pluginReactHooks from "eslint-plugin-react-hooks";
import globals from "globals";
import tseslint from "typescript-eslint";

export default defineConfig([
  // Global ignores - applied to all files
  globalIgnores([
    "dist/**",
    "node_modules/**",
    "build/**",
    "coverage/**",
    "assembly/**",
    "package.json",
    ".markdownlint.jsonc",
  ]),

  // Ignore test files from main linting
  {
    ignores: [
      "**/__tests__/**",
      "**/*.test.{ts,tsx}",
      "e2e/**",
      "jest.setup.ts",
      "playwright.config.ts",
    ],
  },

  // Base JavaScript configuration
  {
    name: "rad.io/js-base",
    files: ["**/*.{js,mjs,cjs,jsx}"],
    ...js.configs.recommended,
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
    linterOptions: {
      reportUnusedDisableDirectives: "error",
      reportUnusedInlineConfigs: "error",
    },
  },

  // TypeScript configuration
  {
    name: "rad.io/typescript-base",
    files: ["**/*.{ts,mts,cts,tsx}"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: {
        ...globals.browser,
        ...globals.node,
      },
      parserOptions: {
        project: "./tsconfig.json",
      },
    },
    linterOptions: {
      reportUnusedDisableDirectives: "error",
      reportUnusedInlineConfigs: "error",
    },
  },

  // TypeScript ESLint recommended configurations
  ...tseslint.configs.recommended.map((config) => ({
    ...config,
    files: ["**/*.{ts,mts,cts,tsx}"],
  })),
  ...tseslint.configs.recommendedTypeChecked.map((config) => ({
    ...config,
    files: ["**/*.{ts,mts,cts,tsx}"],
  })),
  ...tseslint.configs.strict.map((config) => ({
    ...config,
    files: ["**/*.{ts,mts,cts,tsx}"],
  })),
  ...tseslint.configs.strictTypeChecked.map((config) => ({
    ...config,
    files: ["**/*.{ts,mts,cts,tsx}"],
  })),
  ...tseslint.configs.stylistic.map((config) => ({
    ...config,
    files: ["**/*.{ts,mts,cts,tsx}"],
  })),
  ...tseslint.configs.stylisticTypeChecked.map((config) => ({
    ...config,
    files: ["**/*.{ts,mts,cts,tsx}"],
  })),

  // React configuration
  {
    name: "rad.io/react",
    files: ["**/*.{jsx,tsx}"],
    ...pluginReact.configs.flat.recommended,
  },

  // JSX Accessibility configuration
  {
    name: "rad.io/jsx-a11y",
    files: ["**/*.{jsx,tsx}"],
    ...jsxA11y.flatConfigs.recommended,
  },

  // Custom rules configuration
  {
    name: "rad.io/custom-rules",
    files: ["**/*.{js,mjs,cjs,ts,mts,cts,jsx,tsx}"],
    plugins: {
      "react-hooks": pluginReactHooks,
      import: pluginImport,
    },
    settings: {
      react: {
        version: "detect",
      },
      "import/resolver": {
        typescript: true,
        node: true,
      },
    },
    rules: {
      // React rules
      "react/react-in-jsx-scope": "off",
      "react/prop-types": "off", // Using TypeScript for prop validation

      // React Hooks rules
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "error",

      // Note: TypeScript-specific rules are applied in a TS-only block below

      // Import plugin rules
      "import/order": [
        "error",
        {
          groups: [
            "builtin",
            "external",
            "internal",
            "parent",
            "sibling",
            "index",
            "object",
            "type",
          ],
          alphabetize: { order: "asc", caseInsensitive: true },
          "newlines-between": "never",
        },
      ],
      "import/no-cycle": "error",
      "import/no-duplicates": "error",

      // General code quality rules
      "no-console": [
        "error",
        { allow: ["trace", "debug", "info", "warn", "error"] },
      ],
      "no-debugger": "error",
      "prefer-const": "error",
      "no-var": "error",
      eqeqeq: ["error", "always"],
      curly: ["error", "all"],
      "no-implicit-coercion": "error",
      "no-param-reassign": [
        "error",
        {
          props: true,
          ignorePropertyModificationsFor: ["ref", "refs", "state"],
        },
      ],
      "default-case-last": "error",
    },
  },

  // TypeScript-only custom rules (requires type info)
  {
    name: "rad.io/ts-custom-rules",
    files: ["**/*.{ts,mts,cts,tsx}"],
    plugins: {
      "@typescript-eslint": tseslint.plugin,
    },
    rules: {
      // TypeScript rules - Basic
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/explicit-function-return-type": "error",
      "@typescript-eslint/explicit-module-boundary-types": "error",
      "@typescript-eslint/use-unknown-in-catch-callback-variable": "error",
      "@typescript-eslint/no-unsafe-assignment": "error",
      "@typescript-eslint/no-unsafe-member-access": "error",
      "@typescript-eslint/no-unsafe-return": "error",
      "@typescript-eslint/no-unsafe-argument": "error",
      "@typescript-eslint/no-unsafe-enum-comparison": "error",
      "@typescript-eslint/no-redundant-type-constituents": "error",
      "@typescript-eslint/no-unnecessary-type-parameters": "error",
      "@typescript-eslint/no-invalid-void-type": "error",
      "@typescript-eslint/no-confusing-void-expression": [
        "error",
        {
          ignoreArrowShorthand: true,
        },
      ],
      "@typescript-eslint/prefer-promise-reject-errors": "error",
      "@typescript-eslint/restrict-plus-operands": "error",
      "@typescript-eslint/no-implied-eval": "error",
      "@typescript-eslint/no-deprecated": "error",

      // TypeScript rules - Type Safety
      "@typescript-eslint/no-floating-promises": "error",
      "@typescript-eslint/await-thenable": "error",
      "@typescript-eslint/no-misused-promises": "error",
      "@typescript-eslint/promise-function-async": "error",
      "@typescript-eslint/require-array-sort-compare": "error",
      "@typescript-eslint/no-unnecessary-type-assertion": "error",
      "@typescript-eslint/require-await": "error",

      // TypeScript rules - Modern JavaScript Features
      "@typescript-eslint/prefer-nullish-coalescing": "error",
      "@typescript-eslint/prefer-optional-chain": "error",
      "@typescript-eslint/prefer-reduce-type-parameter": "error",
      "@typescript-eslint/prefer-for-of": "error",

      // TypeScript rules - Code Quality
      "@typescript-eslint/switch-exhaustiveness-check": "error",
      "@typescript-eslint/no-unnecessary-condition": [
        "error",
        {
          allowConstantLoopConditions: true,
        },
      ],
      "@typescript-eslint/consistent-type-imports": [
        "error",
        {
          prefer: "type-imports",
          fixStyle: "inline-type-imports",
        },
      ],
      "@typescript-eslint/array-type": ["error", { default: "array-simple" }],
      "@typescript-eslint/consistent-type-definitions": "off", // Allow both type and interface
      "@typescript-eslint/restrict-template-expressions": [
        "error",
        {
          allowNumber: true, // Allow numbers in template literals
          allowBoolean: true,
        },
      ],
      "@typescript-eslint/no-non-null-assertion": "error",

      // TypeScript rules - Naming Conventions
      "@typescript-eslint/naming-convention": [
        "error",
        {
          selector: "default",
          format: ["camelCase"],
          leadingUnderscore: "allow",
          trailingUnderscore: "allow",
        },
        {
          selector: "import",
          format: ["camelCase", "PascalCase"],
        },
        {
          selector: "variable",
          format: ["camelCase", "UPPER_CASE", "PascalCase"],
          leadingUnderscore: "allow",
          trailingUnderscore: "allow",
        },
        {
          selector: "function",
          format: ["camelCase", "PascalCase"],
        },
        {
          selector: "parameter",
          format: ["camelCase"],
          leadingUnderscore: "allow",
        },
        {
          selector: "property",
          format: ["camelCase", "PascalCase", "UPPER_CASE"],
          leadingUnderscore: "allow",
        },
        {
          selector: "typeLike",
          format: ["PascalCase"],
        },
        {
          selector: "enumMember",
          format: ["PascalCase", "UPPER_CASE"],
        },
        {
          selector: "interface",
          format: ["PascalCase"],
          // Prefer I prefix but don't require it for existing code
          custom: {
            regex: "^I?[A-Z]",
            match: true,
          },
        },
      ],
    },
  },

  // JSX Accessibility rules override - only for JSX/TSX files
  {
    name: "rad.io/jsx-a11y-overrides",
    files: ["**/*.{jsx,tsx}"],
    rules: {
      // Accessibility rules - enforce best practices
      "jsx-a11y/alt-text": "error",
      "jsx-a11y/anchor-has-content": "error",
      "jsx-a11y/anchor-is-valid": "error",
      "jsx-a11y/aria-activedescendant-has-tabindex": "error",
      "jsx-a11y/aria-props": "error",
      "jsx-a11y/aria-proptypes": "error",
      "jsx-a11y/aria-role": "error",
      "jsx-a11y/aria-unsupported-elements": "error",
      "jsx-a11y/click-events-have-key-events": "error",
      "jsx-a11y/heading-has-content": "error",
      "jsx-a11y/html-has-lang": "error",
      "jsx-a11y/img-redundant-alt": "error",
      "jsx-a11y/interactive-supports-focus": "error",
      "jsx-a11y/label-has-associated-control": "error",
      "jsx-a11y/mouse-events-have-key-events": "error",
      "jsx-a11y/no-access-key": "error",
      "jsx-a11y/no-autofocus": "error",
      "jsx-a11y/no-distracting-elements": "error",
      "jsx-a11y/no-noninteractive-element-interactions": "error",
      "jsx-a11y/no-noninteractive-tabindex": "error",
      "jsx-a11y/no-redundant-roles": "error",
      "jsx-a11y/no-static-element-interactions": "error",
      "jsx-a11y/role-has-required-aria-props": "error",
      "jsx-a11y/role-supports-aria-props": "error",
      "jsx-a11y/scope": "error",
      "jsx-a11y/tabindex-no-positive": "error",
    },
  },

  // JSON files configuration
  ...[json.configs.recommended].flat().map((config) => ({
    ...config,
    name: "rad.io/json",
    files: ["**/*.json"],
  })),

  // JSONC files configuration
  ...[json.configs.recommended].flat().map((config) => ({
    ...config,
    name: "rad.io/jsonc",
    files: ["**/*.jsonc"],
    language: "json/jsonc",
  })),

  // Prettier integration - must be last to override other configs
  {
    name: "rad.io/prettier",
    files: ["**/*.{js,mjs,cjs,ts,mts,cts,jsx,tsx,json,jsonc}"],
    plugins: {
      prettier,
    },
    rules: {
      "prettier/prettier": "error",
    },
  },
  {
    name: "rad.io/config-prettier",
    ...eslintConfigPrettier,
  },
]);
