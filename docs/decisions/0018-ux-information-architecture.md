# ADR-0018: UX Information Architecture and Page Map

## Status

Accepted

## Date

2025-10-25

## Context

WebSDR Pro is a complex, professional-grade SDR platform targeting multiple user personas (Ham Enthusiast, Radio Monitoring Professional, Academic Researcher, Emergency Communications Volunteer, Broadcast Engineer) with advanced, real-time visualizations and multi-device DSP. The PRD and Roadmap call for a precise, powerful, professional experience with GPU-accelerated spectrum/waterfall, multi-channel demodulation, intelligent scanning, advanced measurement, and robust recording—delivered with accessibility, low latency, and predictable controls.

A clear, durable Information Architecture (IA) is needed to:

- Align navigation and page boundaries with core workflows and personas
- Reduce cognitive load via purposeful grouping and progressive disclosure
- Support real-time operations (low-latency, never-blocking UI)
- Scale to future features (Phase 2–4) without re-shuffling user mental models
- Ensure accessibility (ADR-0017), offline-first (ADR-0010), and robustness (ADR-0011)

Constraints and drivers:

- Real-time DSP offloaded to Web Workers (ADR-0002), GPU rendering (ADR-0003, ADR-0015)
- State via Zustand with persistence (ADR-0009, ADR-0005)
- Parallel FFT worker pool (ADR-0012) and future WebGPU compute
- WebUSB device coordination and future multi-device sync
- Professional instrumentation UX conventions (precise numeric displays, dense controls)

## Decision

Adopt the following UX Information Architecture and page map. Organize the app into a primary working surface for live operations, complementary workspaces for analysis and automation, and supporting libraries/panels for assets and configuration. Keep primary interactions one click from the default landing view.

### Global Shell

- Top app bar: Connection status, sample rate, buffer health, global errors, quick Record toggle
- Primary frequency display (JetBrains Mono) with VFO controls always visible
- Left navigation: Primary workspaces (Monitor, Scanner, Decode, Analysis, Recordings)
- Right side panels (toggleable): Bookmarks, Devices, Measurements, Telemetry/Logs
- Footer status strip (optional on desktop): FPS, GPU mode, audio state, storage usage

### Primary Workspaces (Top-level pages)

#### Monitor (/monitor) — default

- Purpose: Real-time spectrum+waterfall with VFO control for tuning and listening
- Includes: SpectrumCanvas, WaterfallCanvas, VFOControl, S-Meter, AGC/Squelch, mode selector
- Interactions: Click-to-tune, pan/zoom, marker placement, quick record, bookmark current
- Performance: 60 FPS target at 8192 bins; <150ms click-to-audio (PRD)
- Accessibility: Keyboard tuning, focus order, announcers for frequency/mode changes (ADR-0017)
- Dependencies: ADR-0003, ADR-0015, ADR-0008, ADR-0012

#### Scanner (/scanner)

- Purpose: Configure and run range/memory scans with activity logging
- Includes: Scan config (range, steps, thresholds), activity table (timestamp/freq/peak/duration), real-time preview
- Interactions: Start/stop/pause, dwell rules, auto-store to bookmarks, priority channel interrupt
- Success: >10 channels/s fast mode, detection reliability >95% above squelch (Roadmap Iteration 9)
- Accessibility: Full keyboard operation; live region for detections
- Dependencies: ADR-0013, ADR-0014

#### Decode (/decode)

- Purpose: Digital mode decoders (RTTY, PSK31/63/125, SSTV) with mode-specific controls
- Includes: Mode panel, AFC, varicode, live text/image outputs, copy/save
- Interactions: Select mode/preset; start/stop decode; save outputs; link to recording
- Success: Accuracy and latency per PRD Iteration 1; progressive SSTV rendering
- Dependencies: ADR-0016, ADR-0008

#### Analysis (/analysis)

- Purpose: Deep-dive visualization and measurement setup separate from live tuning
- Includes: ConstellationDiagram, EyeDiagram, Spectrogram zoom, phase noise view
- Interactions: Freeze frame, compare snapshots, export annotated images, marker workflows
- Accessibility: Keyboard cursors; prefer-reduced-motion; descriptive labels
- Dependencies: ADR-0015, ADR-0003

#### Recordings (/recordings)

- Purpose: Library for IQ/audio recordings with metadata and export
- Includes: List/grid with filters/tags, playback/preview, SigMF export, storage quotas
- Interactions: Export/download, delete, tag, open in Analysis/Decode
- Success: Handles 20GB+ with quota management; segmented long captures (PRD)
- Dependencies: ADR-0005, ADR-0010

### Supporting Panels (contextual drawers/sheets)

- Bookmarks (panel, /bookmarks as route-capable)
  - Purpose: Save/organize frequencies with metadata, tags, usage
  - Interactions: One-click tune, search, filter; import/export (future)
  - Success: 10k+ entries, full-text search <100ms (PRD)

- Devices (panel, /devices)
  - Purpose: WebUSB SDR management (RTL-SDR, HackRF), per-device settings, connection recovery
  - Interactions: Connect/claim, sample rate/gain/PPM, bias-T, direct sampling, test mode
  - Success: 4+ devices, <5ms sync skew target (future multi-device)

- Measurements (panel, /measurements)
  - Purpose: Markers, delta, channel power, OBW(99%), ACPR, SNR/SINAD, EVM, spectral masks
  - Interactions: Place markers/regions; export CSV/JSON; log with confidence intervals
  - Success: ±1 Hz and ±0.2 dB accuracy after calibration (PRD)

- Telemetry & Logs (panel, /diagnostics)
  - Purpose: Health metrics, buffer overruns, dropped frames, worker errors, reconnection attempts
  - Interactions: Copy logs, download diagnostics bundle, shareable link (privacy-aware)

### Settings & Calibration

- Settings (/settings)
  - Tabs: Display, Radio, Audio, Calibration, Advanced (Roadmap Iteration 10)
  - Patterns: Persist via Zustand persist (localStorage); validation via Zod; profiles export/import

- Calibration (/calibration)
  - Frequency PPM correction, gain offset (dB), IQ balance, DC offset; wizard flow
  - Results stored as profiles and auto-applied; expiration reminders

### Information Architecture (hierarchy)

- Monitor
  - Spectrum | Waterfall | VFO | Audio | Markers
  - Panels: Bookmarks, Measurements, Devices
- Scanner
  - Range | Memory | Parallel | Activity Log
- Decode
  - RTTY | PSK | SSTV | Mode presets
- Analysis
  - Constellation | Eye | Spectrogram | Phase noise | Exports
- Recordings
  - IQ | Audio | Tags | Playback | SigMF export
- Devices (panel/page)
  - Discovery | Claim | Per-device settings
- Bookmarks (panel/page)
  - Search | Filter | Categories | Import/Export (future)
- Measurements (panel/page)
  - Markers | Regions | Logs | CSV/JSON export
- Settings
  - Display | Radio | Audio | Calibration | Advanced | Keyboard shortcuts (future)
- Calibration
  - Wizard | Profiles | Validation | Apply
- Diagnostics
  - Telemetry | Logs | Health | Storage
- Help
  - Onboarding | Keyboard cheat sheet | Release notes

### Routing & Deep Links

- Stable paths: /monitor, /scanner, /decode, /analysis, /recordings, /bookmarks, /devices, /measurements, /settings, /calibration, /diagnostics, /help
- Query params for view state: fftSize, window, palette, minDb/maxDb, vfo, span, mode, squelch, markers
- Share links (privacy-safe) for non-personal state snapshots

### Keyboard Model (high-level)

- Global: 1 Monitor, 2 Scanner, 3 Decode, 4 Analysis, 5 Recordings; ? Help; ,/ . zoom; +/- gain; M mode cycle; W window; B bookmark; R record; G grid; Arrow keys tune; Shift/Alt modifiers for step sizes

### Accessibility Commitments (cross-cutting)

- WCAG 2.1 AA (ADR-0017): Keyboard-first navigation; live regions for status; screen reader labels; focus-visible; prefers-reduced-motion; color-contrast compliance; non-visual alternatives for key readouts (frequency, S-meter, detections)

## Consequences

Positive:

- Clear separation between live operations (Monitor), automation (Scanner), decoding (Decode), deep analysis (Analysis), and library management (Recordings)
- Panels keep critical utilities (Bookmarks, Devices, Measurements) close without page hops
- Scales to Phase 2–4 without reshuffling top-level nav (multi-device, compliance tools, collaboration)
- Matches professional instruments’ mental model (primary live view with dockable tools)
- Enables robust deep linking for workflows, testing, and support

Negative:

- More pages requires consistent routing and URL hygiene
- Potential discoverability trade-offs if too many panels are hidden by default
- Complexity in managing real-time pipelines across route changes; needs careful suspension/resume

## Alternatives Considered

### Single-page workspace with tabs-only content

- Pros: Fewer routes, simpler navigation
- Cons: Poor deep-linking, hard to scale, monolithic complexity, hurts testing and shareability

### Multi-modal “modes” (Receive vs Analyze vs Manage)

- Pros: Simple model
- Cons: Frequent mode switches undercuts real-time workflows; too coarse for diverse personas

### Desktop “MDI” metaphor with floating windows

- Pros: Power-user flexibility
- Cons: Overhead for web, harder on small screens, accessibility challenges, higher cognitive load

## Verification & Success Criteria

- Navigation: Primary tasks reachable in ≤2 clicks from Monitor
- Performance: Monitor maintains 60 FPS (8192 bins) with panels open; route changes don’t drop audio/visual pipelines
- Accessibility: axe-core/Lighthouse 0 critical issues; NVDA keyboard-only tasks pass; focus outlines visible everywhere
- Persistence: Reopen app returns to last workspace and state; per-URL deep link restores view state
- Usability: Task completion time benchmarks (tuning, bookmarking, starting scan, exporting recording) improve vs. baseline

## Implementation Notes & Milestones

- Align with Roadmap:
  - Iteration 3–5: Enhance Monitor visuals and add demodulator controls inline
  - Iteration 9: Scanner workspace completion with activity log and bookmark integration
  - Iteration 10: Settings/Calibration pages; storage management details
  - Phase 2+: Measurements panel maturity; Analysis tools; multi-device Devices page

- Codebase mapping (current):
  - Pages: `src/pages/LiveMonitor.tsx` (/monitor), `src/pages/Scanner.tsx` (/scanner), `src/pages/Analysis.tsx` (/analysis), `src/pages/Visualizer.tsx` (fold into Monitor/Analysis as needed)
  - Panels/Components: Device manager, Recording panel, Bookmark UI (existing per Roadmap)

## Related ADRs

- ADR-0002: Web Worker DSP Architecture
- ADR-0003: WebGL2/WebGPU GPU Acceleration
- ADR-0005: Storage Strategy for Recordings and State
- ADR-0006: Testing Strategy and Framework Selection
- ADR-0008: Web Audio API Architecture
- ADR-0009: State Management Pattern
- ADR-0010: Offline-First Architecture
- ADR-0011: Error Handling and Resilience Strategy
- ADR-0012: Parallel FFT Worker Pool
- ADR-0015: Visualization Rendering Strategy
- ADR-0017: Comprehensive Accessibility Pattern Implementation

## Status & Lifecycle

This ADR is Accepted. It may be refined as features land; significant changes will be proposed in successor ADRs and cross-referenced here. No ADRs are superseded by this decision.

## References

- PRD.md — Experience qualities, components, responsiveness, measurement suite
- ROADMAP.md — Iterations 3–10 and Phase 2 intelligence requirements
- ACCESSIBILITY.md — Implementation checklist and patterns
- UI-DESIGN-SPEC.md — Component choices and visual direction
