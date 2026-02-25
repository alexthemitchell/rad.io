# Keyboard Shortcuts

## Purpose

MVP shortcut map for core receiving workflows implemented in the app today.

## Tuning

| Shortcut | Action | Context | Notes |
| --- | --- | --- | --- |
| `ArrowRight` | Step frequency up (base step) | Global when focus not in text input | Required action |
| `ArrowLeft` | Step frequency down (base step) | Global when focus not in text input | Required action |
| `Shift + ArrowRight` | Large step up | Global when focus not in text input | `10x` current tune step |
| `Shift + ArrowLeft` | Large step down | Global when focus not in text input | `10x` current tune step |
| `Alt + ArrowRight` | Fine-tune (NCO) nudge up | Global when focus not in text input | Adjusts fine offset by `0.1x` configured fine step |
| `Alt + ArrowLeft` | Fine-tune (NCO) nudge down | Global when focus not in text input | Adjusts fine offset by `0.1x` configured fine step |
| `Ctrl + L` | Focus frequency input | Global | Required action |
| `Alt + L` | Focus frequency input (fallback) | Global | Use when browser intercepts `Ctrl + L` |
| `Enter` | Commit frequency edit | Frequency input focused | Required action |
| `Escape` | Cancel frequency edit and restore last committed | Frequency input focused | |

## Stream And Connection

| Shortcut | Action | Context | Notes |
| --- | --- | --- | --- |
| `Space` | Start/Stop stream | Global when focus not in text input | Required action |
| `Ctrl + R` | Reconnect/start stream after disconnect/error | Global | Required action |
| `Ctrl + E` | Retry last failed stream action | Global in error state | |
| `Ctrl + Shift + D` | Export diagnostics | Global | Required action |

## Audio And Analyzer

| Shortcut | Action | Context | Notes |
| --- | --- | --- | --- |
| `M` | Mute/Unmute audio | Global | Required action |
| `P` | Panic mute | Global | Safety shortcut |
| `C` | Center on strongest visible peak | Global when focus not in text input | Analyzer helper |
| `S` | Snap to nearest qualified signal | Global when focus not in text input | Analyzer helper |
| `T` | Tune to marker | Global when focus not in text input | Analyzer helper |
| `X` | Clear marker | Global when focus not in text input | Analyzer helper |
| `R` | Return to last lock | Global when focus not in text input | Retune assist |

## Help And Diagnostics

| Shortcut | Action | Context | Notes |
| --- | --- | --- | --- |
| `?` | Open shortcuts/help overlay | Global | Required action |
| `F1` | Open shortcuts/help overlay | Global | Fallback discoverability |
| `Ctrl + K` | Open command palette | Global | Command entrypoint |
| `Ctrl + /` | Toggle diagnostics event log visibility | Global | |

## Conflicts And Reserved Keys

The following combinations are intentionally avoided for MVP due to browser and OS conflicts:

- `Ctrl + T`, `Ctrl + N`, `Ctrl + W` (tab/window management)
- `Ctrl + Tab` and `Ctrl + Shift + Tab` (tab switching)
- `F5` (browser refresh)

`Ctrl + L` and `Ctrl + R` may conflict with browser shortcuts in some environments; in-app controls and command palette remain available as fallback paths.

## Shortcut Count

Total documented shortcuts: `21`.
