# IA Map

## Primary Regions And Purpose

| Region | Purpose |
| --- | --- |
| Header title + build context | Confirm app identity and mode. |
| Connection status pill | Immediate stream lifecycle visibility. |
| Status message bar | Action-oriented guidance for current state. |
| Waterfall panel | Time-history signal discovery and drift awareness. |
| Spectrum panel | Instant spectral shape and click-to-tune target. |
| Audio scope panel | Demod output sanity check. |
| Source selection controls | Choose input path (`Mock`, `HackRF`, `RTL-SDR`). |
| Stream controls | Start/stop stream lifecycle control. |
| Audio controls | Mute/unmute and audio-state visibility. |
| Tuning controls | Fine tune, numeric frequency, mode select, zoom. |
| Gain controls | Front-end gain staging and overload mitigation. |
| Diagnostics section | Export and inspect support-relevant context. |

## Always Visible Elements

- Connection state pill.
- Status message text.
- Source selector.
- Start/Stop action.
- Frequency and mode controls.
- Diagnostics export action.

Rationale:

- These elements support the core loop and recovery without panel-hunting.

## Contextual Elements

- Gain sliders appear based on active source capabilities.
- Diagnostics event list is expandable and non-blocking.
- Warning text changes with stream, audio, and recovery states.

Rationale:

- Contextual controls reduce clutter while preserving discoverability.

## Discoverability

- Connect/start: first action row and persistent status text.
- Start/Stop: dedicated high-contrast primary button.
- Tune: spectrum click plus frequency input and keyboard arrows.
- Audio enablement: explicit audio-state line and mute/unmute action.

## Recovery Discoverability

- Error/recovery states keep the same action row and diagnostics export.
- No full-screen dead-end states; users can always retry or stop.
