# Frequency Entry Contract

## Input Parsing Rules

- Accept decimal MHz input in MVP (`90.000`, `146.520`).
- Reject empty, NaN, and negative values.
- Reject values outside configured tuner-safe range.
- Normalize to integer Hz internally.

## Focus And Commit Rules

- Focus: selecting input does not auto-commit changes.
- Commit on `Enter` and on blur when value is valid.
- Cancel on `Escape` and restore last committed value.

## Validation Rules

| Case | Behavior | Message |
| --- | --- | --- |
| Invalid numeric format | Do not commit | Enter a valid frequency in MHz (example: 90.000). |
| Out of range | Do not commit | Frequency is out of supported range for this source. |
| Too many decimals | Round to nearest Hz equivalent | Rounded to nearest supported step. |

## Formatting Rules

- Display fixed 3 decimal places in MHz.
- Preserve leading digits; no locale-dependent separators in MVP.

## Keyboard-Only Path

- `Tab` focuses frequency input.
- Type value and press `Enter` to commit.
- `Escape` cancels pending edits.
- Arrow keys provide 1 kHz step outside text-entry mode.

## Accessibility Requirements

- Input has aria-label with units (MHz).
- Validation messages are announced via live region.
- Focus returns to frequency input after validation feedback.
