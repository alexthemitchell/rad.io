Purpose: Document reliable setup for ESLint v9 flat config with typescript-eslint v8 and other plugins in rad.io.

Key points

- We use ESLint v9 flat config (`eslint.config.mjs`) and `typescript-eslint` v8 single entrypoint import: `import tseslint from "typescript-eslint"`.
- When referencing rules by ID (e.g., `@typescript-eslint/no-unused-vars` or `jsx-a11y/alt-text`) inside a custom config block, you must register the plugin in that block’s `plugins` field. The recommended configs bring their own plugin mapping, but our overrides do not.
- Working pattern:
  - Import plugins: `import tseslint from "typescript-eslint"`, `import jsxA11y from "eslint-plugin-jsx-a11y"`, etc.
  - Spread recommended configs (which include parser + plugin) for TS and JSX a11y: `...tseslint.configs.recommended*`, `...jsxA11y.flatConfigs.recommended`.
  - In any block that defines `rules` using namespaced IDs, add `plugins: { "@typescript-eslint": tseslint.plugin, "jsx-a11y": jsxA11y, ... }`.
- Parser: We rely on `tseslint.configs.*` to set `languageOptions.parser`. If you define a TS-only base block before those, it’s fine to omit `parser` there; later configs from tseslint will apply it for TS files.

References in repo

- `eslint.config.mjs` blocks:
  - Added `plugins: { "@typescript-eslint": tseslint.plugin }` to `rad.io/custom-rules`.
  - Added `plugins: { "jsx-a11y": jsxA11y }` to `rad.io/jsx-a11y-overrides`.

Validation

- `npm run lint`, `npm run type-check`, and `npm run build` pass locally after these adjustments.

Pitfall to avoid

- Running `eslint --fix` may still exit with code 1 if non-fixable errors remain; always re-run plain `lint` to confirm status after config edits.
