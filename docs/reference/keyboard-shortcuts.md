# Keyboard Shortcuts

## Purpose

Early MVP shortcut map for core receiving workflows. Shortcuts are grouped by category and include context and notes.

## Tuning

| Shortcut | Action | Context | Notes |
| --- | --- | --- | --- |
| `ArrowRight` | Step frequency up (base step) | Global when focus not in text input | Required action |
| `ArrowLeft` | Step frequency down (base step) | Global when focus not in text input | Required action |
| `Shift + ArrowRight` | Large step up | Global when focus not in text input | Required action; `10x` current tune step |
| `Shift + ArrowLeft` | Large step down | Global when focus not in text input | Required action; `10x` current tune step |
| `Alt + ArrowRight` | Fine step up | Global when focus not in text input | `0.1x` current fine step |
| `Alt + ArrowLeft` | Fine step down | Global when focus not in text input | `0.1x` current fine step |
| `Ctrl + L` | Focus frequency input | Global | Required action |
| `Enter` | Commit frequency edit | Frequency input focused | Required action |
| `Escape` | Cancel frequency edit and restore last committed | Frequency input focused | |
| `=` | Increase zoom span detail | Spectrum focused | Uses unshifted key where available |
| `-` | Decrease zoom span detail | Spectrum focused | |

## Stream And Connection

| Shortcut | Action | Context | Notes |
| --- | --- | --- | --- |
| `Space` | Start/Stop stream (toggle primary stream control) | Control bar focused | Required action |
| `Ctrl + R` | Reconnect after disconnect/error | Global | Required action |
| `Ctrl + E` | Retry last failed action | Global in error state | |
| `Ctrl + Shift + D` | Export diagnostics | Global | Required action |

## Audio

| Shortcut | Action | Context | Notes |
| --- | --- | --- | --- |
| `M` | Mute/Unmute audio | Global | Required action |
| `Ctrl + M` | Toggle audio enablement action | Global | Use when autoplay recovery prompt is present |
| `[` | Decrease volume/gain one step | Audio control focused | |
| `]` | Increase volume/gain one step | Audio control focused | |

## Navigation And Panels

| Shortcut | Action | Context | Notes |
| --- | --- | --- | --- |
| `Tab` | Move focus forward | Global | Core keyboard navigation |
| `Shift + Tab` | Move focus backward | Global | Core keyboard navigation |
| `Ctrl + 1` | Focus primary control panel | Global | |
| `Ctrl + 2` | Focus spectrum panel | Global | |
| `Ctrl + 3` | Focus audio/gain panel | Global | |
| `Ctrl + B` | Toggle non-critical side panel collapse | Global | Must not hide required recovery actions |

## Help And Diagnostics

| Shortcut | Action | Context | Notes |
| --- | --- | --- | --- |
| `?` | Open shortcuts/help overlay | Global | Required action |
| `F1` | Open command/help entrypoint | Global | Fallback discoverability |
| `Ctrl + /` | Toggle diagnostics event log visibility | Global | |

## Conflicts And Reserved Keys

The following combinations are intentionally avoided for MVP due to browser/OS conflicts:

- `Ctrl + T`, `Ctrl + N`, `Ctrl + W` (tab/window management)
- `Ctrl + L` browser address bar conflict in some browsers (used with caution; verify fallback focus key in implementation)
- `Ctrl + Tab` and `Ctrl + Shift + Tab` (tab switching)
- `F5`, `Ctrl + R` browser refresh conflict (if refresh behavior conflicts, use in-app fallback command)

## Shortcut Count

Total documented shortcuts: `25`.
