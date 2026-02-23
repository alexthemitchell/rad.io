# Tooltip

## Purpose

Provide short, supplemental explanations for controls without replacing visible labels or help content.

## Anatomy

- Trigger element.
- Tooltip container.
- Plain text content.

## States

| State | Behavior |
| --- | --- |
| `hidden` | Not visible |
| `visible` | Displayed near trigger |
| `focus-visible` | Trigger retains focus ring while tooltip is shown |
| `disabled` | Tooltip not shown for disabled control unless static explanation is required |

## Behavior Rules

- Tooltip is supplementary and never the only source of required instructions.
- Show on hover and keyboard focus.
- Hide on blur, pointer leave, or `Escape`.
- Avoid interactive controls inside tooltip in MVP.

## Keyboard Behavior

- `Tab`: focus trigger and show tooltip.
- `Escape`: hide visible tooltip and keep trigger focus.

## Screen Reader Behavior

- Tooltip content is associated to trigger as description.
- Content is concise and avoids repeating label text verbatim.

## Error And Empty-State Guidance

- Do not use tooltip for blocking errors.
- Use alert or inline validation for actionable failures.

## UX Contract Alignment

- `docs/ux/contracts/tuning-interaction-contract.md`
- `docs/ux/contracts/empty-and-error-state-catalog.md`
- `docs/ux/contracts/keyboard-shortcut-contract.md`
