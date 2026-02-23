# Connection UX Contract

## Always Visible Elements

- Connection status pill (`idle`, `starting`, `streaming`, `recovering`, `error`).
- Primary stream action (`Start` or `Stop`).
- Source selector (`Mock`, `HackRF`, `RTL-SDR`).
- Status message area with the current required user action.
- Diagnostics export action.

## Device Connection State Machine

| State | Entry Condition | Allowed Transitions | Primary UI Action | Exit Condition | Telemetry Event |
| --- | --- | --- | --- | --- | --- |
| `idle` | App loaded or stream stopped | `pairing`, `error` | `Start` | User initiates start | `connection_idle` |
| `pairing` | User starts and permission prompt/device open begins | `connected`, `error` | Select a device in browser prompt | Device open succeeds | `connection_pairing` |
| `connected` | Device opened and configured | `streaming`, `error` | Start stream | First data block accepted by worker | `connection_connected` |
| `streaming` | Data pipeline active | `recovering`, `error`, `idle` | `Stop` | User stops or disconnect occurs | `connection_streaming` |
| `recovering` | Mid-stream interruption (disconnect, background degrade, restart) | `streaming`, `error`, `idle` | `Reconnect` or `Stop` | Pipeline restored or abandoned | `connection_recovering` |
| `error` | Start/open/stream transition fails | `idle`, `pairing` | `Retry` | User retries or cancels | `connection_error` |

## Recovery Flows

### Device Disconnect Mid-Stream

1. Enter `recovering`.
2. Show message: "Device disconnected. Reconnect and try Start."
3. Keep controls enabled for retry without reload.
4. On successful restart, return to `streaming`.

### Permission Revoked

1. Enter `error`.
2. Show message: "Permission required. Grant USB permission and retry."
3. Provide `Retry` action.

### Device Busy / Claimed Elsewhere

1. Enter `error`.
2. Show message: "Device is busy. Close other SDR apps/tabs and retry."
3. Provide `Retry` and diagnostics export actions.

### User Denies Permission

1. Enter `error`.
2. Show message: "No device selected. Choose a device to continue."
3. Keep user in same screen; no hard failure modal.

## Accessibility Requirements

- Status text region must use `aria-live="polite"` for state changes.
- Keyboard-only operation required for source select, start/stop, mute, and frequency controls.
- Focus must remain in-app after state changes; no hidden focus traps.
- Error states must include at least one keyboard-activatable recovery action.
