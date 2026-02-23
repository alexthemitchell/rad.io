# Toggle Spec

## Purpose

Toggles represent immediate on/off state for persistent settings (for example mute state).

## Anatomy

- Control track/thumb or segmented representation.
- Visible label and explicit current value text (`On`, `Off`, `Muted`).

## States

| State | Behavior |
| --- | --- |
| `on` | Enabled behavior active. |
| `off` | Enabled behavior inactive. |
| `focus-visible` | Focus ring visible. |
| `disabled` | Not changeable; include reason if non-obvious. |

## Keyboard

- `Tab`: focus toggle.
- `Space`: toggle state.
- `Enter`: toggle state when presented as button semantics.

## Screen Reader Requirements

- Expose binary checked state.
- Label must communicate feature and state.
- State changes should be announced in live status region when safety-relevant (for example mute).

## Safety Rules

- Mute toggle is soft mute; stream continues unless explicitly stopped.
- Toggle action must be reversible from keyboard only.

## Contract References

- `docs/ux/contracts/audio-ux-contract.md`
- `docs/ux/contracts/keyboard-shortcut-contract.md`
