# Audio UX Contract

## Audio State Machine

| State | Entry Condition | Allowed Transitions | User Signal | Primary Action | Telemetry Event |
| --- | --- | --- | --- | --- | --- |
| `suspended` | No active AudioContext | `awaiting-user-gesture`, `running` | "Audio suspended" | `Start` | `audio_suspended` |
| `awaiting-user-gesture` | Browser policy blocks resume/start | `running`, `muted` | "Audio requires user gesture" | `Start` or `Unmute` | `audio_user_gesture_required` |
| `running` | AudioContext running and not muted | `muted`, `degraded`, `suspended` | "Audio running" | `Mute` | `audio_running` |
| `degraded` | Background throttling or timing instability detected | `running`, `muted`, `suspended` | "Audio timing may degrade" | Return to foreground or reduce load | `audio_degraded` |
| `muted` | User toggles mute | `running`, `suspended` | "Audio muted" | `Unmute` | `audio_muted` |

## Rules

- Start attempts must call `AudioContext.resume()` from a user action path.
- If `resume()` does not produce `running`, UI must stay operable and show recovery copy.
- Muting is soft: pipeline continues, output gain is set to zero.
- Stopping stream returns audio to `suspended`.
- Background tab state may move `running` to `degraded` without forcing stop.

## Recovery Policies

- Autoplay blocked: show explicit next step, no modal dead-end.
- Sleep/wake or tab restore: attempt automatic return to `running`; if not possible, request user action.
- Degraded state must not hide controls.

## Accessibility Requirements

- Audio-state message is announced through `aria-live="polite"`.
- Mute/unmute is keyboard accessible and has a visible state label.
- Error/degraded text must not rely on color alone.
