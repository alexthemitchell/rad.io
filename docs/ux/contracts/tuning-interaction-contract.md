# Tuning Interaction Contract

## Interaction Matrix

| Gesture | Preconditions | Action | Result | Notes |
| --- | --- | --- | --- | --- |
| Click spectrum bin | Stream active | Set fine-tune offset to clicked bin delta | Selected signal moves toward center | Primary tune gesture |
| Click-drag spectrum | Stream active | Continuous tune updates while dragging | Progressive retune | Cancel with `Escape` |
| Mouse wheel over spectrum | Pointer over panel | Step tune by default step | Incremental retune | Shift accelerates |
| Double-click spectrum | Stream active and click target valid | Center tune on target bin | Fast center-on-signal | No modal confirmation |
| Shift + wheel | Stream active | Step by large increment | Coarse retune | 10x base step |
| Alt + wheel | Stream active | Step by fine increment | Precision retune | 0.1x base step |
| Keyboard ArrowLeft/ArrowRight | Focus not in input field | Step frequency down/up | Deterministic 1 kHz step | Keyboard-only path |

## Selection Snapping Rules

- Click-to-tune snaps to nearest FFT bin center.
- Drag updates are rate-limited to keep UI responsive.
- If target is outside visible span, clamp at nearest span edge.

## Double-Click Rule

- Double-click is reserved for direct center retune.
- It must not toggle stream state or open modal UI.

## Telemetry Hooks

- `tune_click`
- `tune_drag`
- `tune_wheel`
- `tune_keyboard_step`
- `tune_center_on_double_click`

## Accessibility Requirements

- Keyboard path must support all tune actions without pointer.
- Tuned-frequency change must be announced via live region.
- Tuning controls require explicit labels and current value text.
