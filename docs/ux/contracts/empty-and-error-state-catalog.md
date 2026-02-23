# Empty And Error State Catalog

| State ID | Category | Trigger Or Detection | Message Intent | Primary Action | Secondary Action | Telemetry Event |
| --- | --- | --- | --- | --- | --- | --- |
| `empty_no_device` | Empty | No source connected and stream not started | Explain baseline idle state | Start | Export diagnostics | `state_empty_no_device` |
| `empty_no_signal` | Empty | Running, low FFT variance for sustained window | Explain no visible RF energy | Tune frequency | Adjust gain | `state_empty_no_signal` |
| `warn_likely_mistuned` | Warn | Strong edge energy, low center energy near tuned bin | Suggest retune | Click signal peak | Increase zoom | `state_warn_likely_mistuned` |
| `error_permission_denied` | Error | Browser permission denied | Explain missing permission | Retry | Help | `state_error_permission_denied` |
| `error_permission_revoked` | Error | Access revoked after prior success | Explain re-pair requirement | Retry | Export diagnostics | `state_error_permission_revoked` |
| `error_device_busy` | Error | Open/transfer fails with busy-style error | Explain contention | Retry | Stop other app | `state_error_device_busy` |
| `error_device_disconnected` | Error | Device disappears while streaming | Explain unplug/replug flow | Reconnect | Stop | `state_error_device_disconnected` |
| `error_stream_start` | Error | Stream starts but first data does not arrive | Explain startup issue | Retry | Export diagnostics | `state_error_stream_start` |
| `error_stream_runtime` | Error | Runtime transfer loop throws repeatedly | Explain unstable stream | Reconnect | Export diagnostics | `state_error_stream_runtime` |
| `warn_dropped_samples` | Warn | Telemetry drop counter increases | Warn about quality impact | Reduce rate/load | Continue | `state_warn_dropped_samples` |
| `warn_render_overloaded` | Warn | Frame cadence below threshold | Warn about visual load | Reduce zoom/load | Continue | `state_warn_render_overloaded` |
| `warn_audio_blocked` | Warn | Audio context not running after start | Explain gesture policy | Start again | Help | `state_warn_audio_blocked` |
| `warn_audio_device_missing` | Warn | Output path unavailable | Explain output issue | Retry | Mute | `state_warn_audio_device_missing` |
| `warn_audio_degraded` | Warn | Visibility change to hidden while running | Explain background throttling | Return foreground | Continue | `state_warn_audio_degraded` |
| `state_muted` | Info | User toggles mute | Confirm muted status | Unmute | Stop | `state_muted` |
| `state_recovering` | Info | Recovery transition active | Explain retry progress | Reconnect | Stop | `state_recovering` |
| `state_diagnostics_exported` | Info | Diagnostics bundle generated | Confirm artifact output | Download again | Close | `state_diagnostics_exported` |
| `error_unknown` | Error | Unclassified exception | Provide safe fallback action | Retry | Export diagnostics | `state_error_unknown` |

## Show/Suppress Rules

- Suppress transient warnings shorter than 250 ms to avoid UI flicker.
- Do not hide an active error until the trigger clears or user acts.
- If multiple issues exist, show highest severity first (`error` > `warn` > `info`).
- Keep a diagnostic history list so suppressed states remain auditable.

## Accessibility Notes

- State changes announced via `aria-live="polite"`.
- Recovery action must be reachable via keyboard.
- Error text and action labels must stand alone without color cues.
