# MVP User Flows

## Flow 1: First Session Start

- Start state: `idle`, no active stream.
- Primary actions: choose source -> `Start`.
- End state: `streaming`, status text confirms source.

## Flow 2: Retune While Streaming

- Start state: `streaming`.
- Primary actions: click spectrum or use frequency input/arrow keys.
- End state: tuned frequency updated and visuals remain active.

## Flow 3: Zoom And Fine Tune Adjustment

- Start state: `streaming`.
- Primary actions: adjust zoom and fine-tune sliders.
- End state: visible spectrum context and tune offset updated.

## Flow 4: Mute And Unmute

- Start state: `streaming`, `audio running`.
- Primary actions: press `M` or click `Mute`, then `Unmute`.
- End state: `audio muted` then `audio running`.

## Flow 5: Recovery From Disconnect Or Start Error

- Start state: `streaming` or `starting`.
- Primary actions: see recovery/error status -> `Retry`/`Start` -> optional diagnostics export.
- End state: `streaming` on success or `idle` on user stop.

## Flow 6: Diagnostics Export

- Start state: any connection/audio state.
- Primary actions: click `Export Diagnostics`.
- End state: local JSON bundle downloaded and event logged.
