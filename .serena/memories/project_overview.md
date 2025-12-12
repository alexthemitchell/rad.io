# Project Overview: rad.io

## Purpose
rad.io is a professional, browser-based SDR visualizer/receiver with a strong emphasis on:
- WebUSB device support (HackRF first-class), plus mock/file sources for deterministic development.
- A worker-based DSP pipeline feeding spectrum/waterfall rendering and WebAudio output.
- Observability: telemetry, diagnostics bundles, and reproducible exports.

## Tech Stack (current/target)
- TypeScript-first (roadmap explicitly calls for strict TypeScript).
- Browser runtime targets: Chrome/Edge on Windows first (per roadmap).
- Planned: WebUSB + WebAudio (AudioWorklet preferred), Web Workers, optional SharedArrayBuffer path (COOP/COEP).

## Repo State (as observed)
- Documentation-first: main artifact is docs/ROADMAP.md.
- Package metadata exists (package.json) but npm scripts/deps appear to be intentionally not finalized yet.

## Development Principles (from roadmap)
- Mock-first and deterministic fixtures before hardware.
- “Contracts first”: ADRs for worker topology, message schema, state/persistence boundaries, and error taxonomy.
- Performance and reliability budgets with measured regression gates.
