# Tuning And Frequency Entry Copy

## Inline Guidance

- Helper text: Use MHz format (example: `90.000`).
- Precision guidance: Arrow keys adjust by 1 kHz.

## Validation Messages

| Case | Message |
| --- | --- |
| Invalid value | Enter a valid frequency in MHz (example: 90.000). |
| Out of range | Frequency is out of supported range for this source. |
| Rounded value | Frequency rounded to nearest supported step. |
| Mistuned hint | Signal appears off-center. Try click-to-tune on the peak. |

## Accessible Labels

- Frequency input: `Frequency in megahertz`.
- Fine tune slider: `Fine tune offset in hertz`.
- Zoom slider: `Spectrum zoom level`.

## Error Recovery Actions

- Primary: Retry with valid frequency.
- Secondary: Export diagnostics when persistent tuning issues occur.
