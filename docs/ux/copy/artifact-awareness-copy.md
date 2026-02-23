# Artifact Awareness Copy

## Warning Messages

| Warning ID | Message | Primary Action | Secondary Action |
| --- | --- | --- | --- |
| `warn_dc_spur` | A strong center spike may be a receiver artifact, not a signal. | Shift center slightly | Learn more |
| `warn_image_like` | This mirrored peak may be an image artifact. | Retune target peak | Learn more |
| `warn_aliasing_risk` | Current settings may cause aliasing-like artifacts. | Apply safer settings | Learn more |

## Action Labels

- Shift center
- Retune target
- Apply safer settings
- Undo change
- Learn more

## Placeholder Guidance

- `{frequency}` for current tuned frequency.
- `{centerFrequency}` for display center.
- `{suggestedStep}` for recommended center shift.

## Accessibility Copy Rule

Each warning must include both a short diagnosis and a clear next action in the same sentence.
