# Token Naming And Usage

## Naming Convention

Use a semantic, category-first naming structure:

`--<category>-<role>-<variant>-<state>`

Examples:

- `--color-surface-base`
- `--color-text-primary`
- `--color-accent-default-hover`
- `--space-3`
- `--focus-ring-color`

## Naming Rules

- Names describe intent, not component (`--color-border-default`, not `--button-border`).
- Prefer stable roles (`surface`, `text`, `accent`, `danger`) over one-off labels.
- Include state only when the value differs from default.
- Keep names predictable; avoid abbreviations except common units (`sm`, `md`, `lg`).
- A token name must be reusable across at least two components or one component plus one layout context.

## Reuse Vs New Token Decision

Create a new token only when one of these is true:

- Existing semantic token cannot meet contrast or accessibility requirements.
- A new interaction state is introduced and reused by multiple components.
- A domain-specific visualization role is needed (`visualization-*`).

Do not create a new token when:

- Difference is component taste rather than UX meaning.
- Difference can be solved by spacing/layout composition.
- The value exists under a semantic alias already.

## Do Examples

1. Use `--color-surface-raised` for panels and popovers.
2. Use `--color-text-primary` for default readable text.
3. Use `--color-text-secondary` for supplemental metadata.
4. Use `--color-border-focus` with focus ring tokens on keyboard focus.
5. Use `--color-accent-default` for primary actions.
6. Use `--color-danger-default` for destructive confirmation actions.
7. Use `--space-2` and `--space-3` for dense control rows.
8. Use `--text-size-3` for primary frequency display values.
9. Use `--motion-duration-fast` for short non-critical transitions.
10. Use `--motion-duration-instant` when reduced motion is enabled.

## Do Not Examples

1. Do not create `--color-blue-500` for app-facing usage.
2. Do not create `--button-primary-bg`; use semantic accent tokens.
3. Do not use hard-coded hex values in component styles.
4. Do not encode severity only through color without copy.
5. Do not create separate spacing scales per component family.
6. Do not use hover colors as focus indicators.
7. Do not use motion tokens for data visualization frame rate.
8. Do not create tokens for single temporary experiments.
9. Do not use locale-dependent number separators in token names.
10. Do not bypass focus tokens by setting `outline: none` without replacement.

## Usage Notes

- Prefer alias tokens in components and map them to theme primitives at the theme layer.
- When introducing a new token, update:
  - `docs/design-system/design-tokens-spec.md`
  - `docs/design-system/theme-contrast-requirements.md` (if color related)
  - impacted component specs in `docs/design-system/components/`
