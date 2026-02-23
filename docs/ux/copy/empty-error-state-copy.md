# Empty And Error State Copy

## State Copy

| State ID | User Message | Primary Action | Secondary Action |
| --- | --- | --- | --- |
| `empty_no_device` | No source is active yet. Start streaming to begin. | Start | Export diagnostics |
| `empty_no_signal` | No clear signal detected at this frequency. | Tune frequency | Adjust gain |
| `warn_likely_mistuned` | Signal energy is off-center. You may be slightly mistuned. | Click signal peak | Increase zoom |
| `error_permission_denied` | Device permission was denied. Grant permission to continue. | Retry | Help |
| `error_permission_revoked` | Device permission was revoked. Reconnect and retry. | Retry | Export diagnostics |
| `error_device_busy` | Device is busy in another app or tab. | Retry | Stop other app |
| `error_device_disconnected` | Device disconnected during streaming. | Reconnect | Stop |
| `error_stream_start` | Stream could not start cleanly. | Retry | Export diagnostics |
| `error_stream_runtime` | Stream interrupted unexpectedly. | Reconnect | Export diagnostics |
| `warn_dropped_samples` | Sample drops detected. Audio or visuals may degrade. | Reduce rate or load | Continue |
| `warn_render_overloaded` | Rendering is overloaded. Frame rate has dropped. | Reduce zoom or load | Continue |
| `warn_audio_blocked` | Audio needs a user gesture to continue. | Start again | Help |
| `warn_audio_device_missing` | Audio output is unavailable right now. | Retry audio | Mute |
| `warn_audio_degraded` | Background mode may reduce audio timing quality. | Return to app | Continue |
| `state_muted` | Audio is currently muted. | Unmute | Stop |
| `state_recovering` | Recovering stream state. Please wait. | Reconnect | Stop |
| `state_diagnostics_exported` | Diagnostics bundle exported successfully. | Export again | Close |
| `error_unknown` | Something unexpected happened. You can retry safely. | Retry | Export diagnostics |

## Accessibility Behavior

- Announce state message in live region.
- Move focus to the first recovery action for blocking errors.
- Keep escape route available (`Stop`) for all blocking errors.
