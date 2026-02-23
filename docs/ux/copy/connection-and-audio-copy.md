# Connection And Audio Copy

## Connection Copy

| State | Message | Primary Action | Secondary Action | Help Target |
| --- | --- | --- | --- | --- |
| `idle` | Ready to start. Select a source and begin streaming. | Start | Export diagnostics | `support/connection-start` |
| `pairing` | Select `{deviceName}` in the browser prompt to continue. | Open device prompt | Cancel | `support/device-permissions` |
| `connected` | `{deviceName}` connected. Starting stream. | Start stream | Stop | `support/stream-start` |
| `streaming` | Streaming from `{deviceName}`. | Stop | Export diagnostics | `support/live-stream` |
| `recovering` | Connection interrupted. Reconnect `{deviceName}` and retry. | Reconnect | Stop | `support/recovery` |
| `error_permission` | Permission required. Grant device access and retry. | Retry | Export diagnostics | `support/device-permissions` |
| `error_busy` | Device is busy in another app or tab. | Retry | Export diagnostics | `support/device-busy` |
| `error_not_found` | No device selected. Choose a device to continue. | Retry | Cancel | `support/no-device` |

## Audio Copy

| State | Message | Primary Action | Secondary Action | Help Target |
| --- | --- | --- | --- | --- |
| `suspended` | Audio is suspended until streaming starts. | Start | Mute | `support/audio-start` |
| `awaiting-user-gesture` | Audio needs a user gesture. Click Start again. | Start | Export diagnostics | `support/audio-gesture` |
| `running` | Audio running normally. | Mute | Export diagnostics | `support/audio-running` |
| `degraded` | Audio may stutter while app is in the background. | Return to app | Reduce load | `support/audio-degraded` |
| `muted` | Audio is muted. | Unmute | Stop | `support/audio-muted` |

## Accessibility Notes

- Announce each state transition using the status live region.
- Keep action labels imperative and short.
- Avoid standalone words like "failed" without a next action.
