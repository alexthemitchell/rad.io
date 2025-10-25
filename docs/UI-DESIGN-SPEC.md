# WebSDR Pro – World‑Class UI Design Spec

Date: 2025‑10‑25
Owner: Design Systems (rad.io)

This document defines the end‑to‑end user interface for WebSDR Pro. It is grounded in the PRD (precision, power, professional), Roadmap personas, and ADRs for visualization, GPU acceleration, worker pools, and accessibility.

References

- PRD.md (mission, features, color/typography)
- ROADMAP.md (personas, phases)
- ARCHITECTURE.md (MVH structure, tech stack)
- ACCESSIBILITY.md, ADR‑0017 (WCAG AA patterns)
- ADR‑0003 (WebGL2/WebGPU), ADR‑0015 (Visualization), ADR‑0019 (Viridis), ADR‑0012 (FFT worker pool)

---

## 1. Target users and success criteria

Primary personas

- Ham Radio Enthusiast (Experimenter): quick tune, decode PSK/RTTY/SSTV, record, bookmarks
- Radio Monitoring Professional (Analyst): calibrated spectrum, markers, logging, export
- Academic Researcher (Scientist): datasets (SigMF), teaching visuals, reproducibility
- Emergency Communications (Responder): reliability, simplicity, fast access to known channels
- Broadcast Engineer (Professional): measurement suite, mask checks, reporting

Success criteria

- High‑density yet legible UI; core tasks achieved with <3 actions
- Real‑time interactions never block visuals; tuning latency <16 ms feedback
- Keyboard‑first operation; full WCAG 2.1 AA compliance
- Consistent, inspectable outputs: exportable images, CSV/JSON logs, SigMF metadata

---

## 2. Information architecture (IA)

Global shell

- Top app bar: brand (rad.io), Connect/Device menu, Record, Bookmarks, Settings, Help
- Main work area: Dockable panes (Spectrum, Waterfall, Constellation, Eye, Tools)
- Left sidebar (collapsible): Devices, Bookmarks, Scanner, Recordings
- Right sidebar (collapsible): Radio controls (Frequency, Mode, Filters, AGC, Squelch, Audio)
- Bottom status bar: sample rate, buffer health, GPU mode (WebGPU/WebGL/2D), FPS, storage

Primary routes

- Live Monitor (default): Spectrum + Waterfall stacked, right controls, bottom status
- Scanner: Scan configuration + activity log + mini‑spectrum
- Analysis: Constellation, Eye, advanced measurements, marker table
- Recordings: Library, playback, export, quota management

View/pane model

- Panes can be stacked or split; layout persists. Default Live layout:
  - Left: Bookmarks (collapsed on small widths)
  - Center: Spectrum (top), Waterfall (bottom)
  - Right: Controls

---

## 3. Visual language and theming

Design intent

- “Modern laboratory instrument” aesthetic (PRD): dark UI, high contrast, minimal chrome
- Color is functional; avoid decorative gradients in analysis areas

Color system (OKLCH; see tokens)

- Backgrounds: Void Black, Deep Slate, Gunmetal
- Foreground: Silver, Muted Gray
- Accent: Cyan (tuning), Electric Blue (primary action)
- Status: Green (good), Amber (warning), Red (error)
- Visualization palettes: Viridis (default), Plasma/Inferno/Magma options; grayscale option

Typography

- Inter (UI), JetBrains Mono (numeric/measurements). Tabular figures for all numeric readouts.
  - Implementation: numeric readouts use tabular figures and slashed‑zero for clarity.
  - Utility class: `.rad-tabular-nums` enables this where needed.

Density and spacing

- Default compact density; 12/16/24 px spacers; 8 px for icon toolbars

Elevation

- Subtle shadows for interactive cards/panels; avoid heavy blur; emphasize content not chrome

Theming and system integration

- Token‑driven themes via CSS Custom Properties (see `src/styles/tokens.css`).
- Default dark theme; opt‑in light theme via `.theme-light` or `[data-theme="light"]`.
- System coherence with `color-scheme: dark light` set on `:root`.
- Global `accent-color` sourced from `--rad-accent` for supported form controls.

---

## 4. Core layout and interactions

4.1 Tuning and VFO control

- Large FrequencyDisplay (JetBrains Mono, bold, tabular figures). Digit‑precise editing: arrow keys to increment digit under caret; scroll to change digit under cursor; Shift for coarse steps.
- VFO markers in Spectrum/Waterfall; click‑to‑tune; drag to fine‑tune; right‑click context menu (set bandwidth, bookmark, record here).
- Keyboard: ↑/↓ fine, PgUp/PgDn coarse, `[ / ]` step size, M to cycle modes.

  4.2 Spectrum analyzer

- 60 FPS target with 8192 bins (ADR‑0015). WebGPU/WebGL primary; worker/2D fallback.
- Pan/zoom on X; Zoom region via drag. Grid overlays with auto‑scaled units (Hz/kHz/MHz).
- Markers: M1… Mn; delta display; peak hold trace; RBW indicator; calibrated power units per PRD.

  4.3 Waterfall

- GPU texture scroll; Viridis colormap; line rate selectable; history 1m‑24h with compression.
- Click‑to‑tune in history; hover tooltip (time, freq, power); export PNG with timestamp and scale.

  4.4 Demodulation & audio

- Mode selector (AM/FM/SSB/CW + digital modes). Bandwidth presets with visual FilterShape editor.
- Audio controls: play/pause, volume, mute, squelch with visual indicator, AGC speed.
- Status meters: S‑meter, audio VU with peak hold; clipping indicator.

  4.5 Measurement suite (pro/analysis)

- Marker table, channel power, occupied bandwidth, ACPR, SNR/SINAD, EVM. Export CSV.
- Spectrum mask overlays; pass/fail badges; report generator hooks.

  4.6 Scanner

- Modes: Sequential, Memory, Band. Config panel; activity log with thumbnails; priority channel.
- Visual scan progress; dwell logic UI; quick bookmark action.

  4.7 Bookmarks & DB

- Hierarchical folders; tags; search; import/export (CSV, RadioReference). Visual markers on panes.

  4.8 Recordings

- IQ + audio; trigger modes; storage management; SigMF metadata; export flows.

  4.9 Settings

- Tabs: Device, Display, Audio, Calibration, Advanced.
- Keyboard shortcuts reference and customization. Import/export settings JSON.

---

## 5. Accessibility (WCAG 2.1 AA)

- Landmark structure: header, nav, main, aside, footer; skip link first tab stop.
- Keyboard‑first: all controls accessible; focus order mirrors visual order; focus ring ≥3:1 contrast.
- Live regions: connection changes, frequency changes, detection events, errors.
- Canvas accessibility: role=img + rich aria‑label with sample counts, peaks, ranges; data table fallback.
- Reduced motion: respect prefers‑reduced‑motion; disable nonessential transitions. A global safeguard clamps animation/transition durations when users opt out of motion.
- Colormaps: Perceptually uniform (Viridis); no sole reliance on color for meaning.
- Sonification toggle for waterfall (optional enhancement, ADR‑0017 example).

---

## 6. Performance and resilience

- Rendering: Progressive enhancement (WebGPU → WebGL2/1 → OffscreenCanvas+Worker → 2D). Detect and announce active tier in status bar.
- Frame pacing: prioritize visualization over secondary UI animations; drop UI transitions under load.
- Health: buffer overrun/underrun indicators; auto‑throttle FFT size when needed; surface warnings.
- Recovery: WebGL context loss handling; auto re‑init; user notification with retry.

---

## 7. Keyboard shortcuts (default)

Global

- Ctrl/Cmd+K: Command palette
- Ctrl/Cmd+S: Start/stop recording
- Ctrl/Cmd+F: Focus frequency input
- ?: Show shortcuts help

Tuning

- Arrow Up/Down: ± fine step
- Page Up/Down: ± coarse step
- `[ / ]`: Cycle step sizes
- M: Cycle modes; Shift+M: Mode menu

Spectrum/Waterfall

- 1/2/3/4: Switch tabs (Spectrum/Waterfall/Constellation/Tools)
- Z: Zoom to selection; X: Reset zoom
- P: Toggle peak hold; G: Toggle grid; R: RBW on/off
- B: Add bookmark from cursor; Enter: Click‑to‑tune at cursor

Scanner & Bookmarks

- . / , : Scan next/prev; Space: Pause/resume
- Ctrl/Cmd+B: New bookmark; Del: Delete bookmark

All shortcuts configurable in Settings.

---

## 8. Component library

Foundations (existing components retained, refined)

- Spectrum (current Spectrogram), Waterfall (Spectrogram waterfall mode), IQConstellation, WaveformVisualizer
- ControlBar (DeviceControlBar), RadioControls, AudioControls, BandwidthSelector, SignalStrengthMeter
- Dialogs (import/export/settings), Table (virtualized), Tabs, Tooltip, Badge, Separator

New/extended components

- FrequencyDisplay (digit editing, unit auto‑scale)
- VFOControl (dial + digit entry)
- FilterShape editor (passband/stopband cursors)
- MarkerTable (measurements with CSV export)
- StatusBar (GPU tier, FPS, buffer health, storage)

Design contracts (per component)

- Inputs: typed props; all interactive elements with aria‑label/aria‑describedby; keyboard handlers
- Outputs: onChange/onSelect events, logged to event bus for AccessibleStatus region
- Error modes: render error banner + fallback controls; never throw without UI notice

---

## 9. Responsive behavior

- ≥1024 px: full layout (left bookmarks, center panes, right controls)
- 768–1023 px: sidebars collapse to sheets; panes stack; waterfall fullscreen toggle
- ≤767 px: single column; spectrum dominant; bottom sheet for controls; 1 VFO only; reduced FFT size

Touch targets ≥44×44 px on mobile; drag/zoom adapted to touch gestures; haptics optional.

---

## 10. Design tokens (brief)

Tokens are defined in `src/styles/tokens.css` (OKLCH) and drive both light and dark themes. Key groups:

- Color: background/foreground, primary, accent, success/warn/error, border, ring
- Typography: font stacks; type scale variables (0.75/0.875/1/1.25/1.5 rem); line‑height presets
- Spacing: 2/4/8/12/16/24/32/48 px scale
- Radius: 2/4/6/8/12 px; border width
- Elevation: shadow levels (1/2/3)
- Z‑index: overlay (1000), modal (1100), toast (1200)
- Motion: transition speeds (fast/medium/slow) and standard easing curve
- Focus: ring color, width, offset

Adoption plan: incremental—map existing CSS to variables, enable dark theme via root class without breaking tests.

---

## 11. Error, empty, and offline states

- Device unavailable (non‑Chromium): Show guidance, simulate mode toggle, link to docs
- USB disconnect: Non‑blocking toast + reconnect attempts; preserve state; prominent status badge
- GPU fallback: Toast + status bar indicator ("Rendering with Canvas 2D fallback")
- Storage near quota: Banner with cleanup wizard link
- Empty panes: concise explainer + primary action; never blank screens

---

## 12. QA and verification

- A11y: jest‑axe suite must stay green; add tests for new components; enforce 25+ jsx‑a11y rules
- Performance: add opt‑in FPS monitor in dev; add benchmarks for 60 FPS target (8192 bins)
- Cross‑browser: Chrome/Edge primary; Safari/Firefox with graceful USB fallbacks
- E2E: Playwright flows for Connect → Tune → Record → Export, and Scanner workflows

---

## 13. Implementation plan (incremental, low risk)

Phase A – Foundations

- Introduce tokens.css; create StatusBar; add GPU tier/fps/buffer health; no visual breakage
- Add FrequencyDisplay and VFOControl components (not yet wired)
- Write keyboard shortcuts help (? overlay)

Phase B – Layout and panes

- Add resizable split panes for Spectrum/Waterfall; persist layout
- Migrate existing Spectrogram/Waterfall views into panes; maintain current tests

Phase C – Measurement tools

- Add MarkerTable; implement deltas and CSV export
- Add RBW, peak hold, and grid toggles to Spectrum toolbar

Phase D – Scanner and logging

- Scanner UI per roadmap; activity log with waterfall thumbnails

Phase E – Calibration and settings

- Add calibration wizard UI (PPM and gain offset); storage management details

All phases: preserve accessibility guarantees, maintain green tests, run lint/type checks, keep diffs focused.

---

## 14. Visual references (conceptual)

- Layout: Top bar, left bookmarks, center stacked Spectrum/Waterfall, right controls, bottom status bar
- Styling: Dark panels on deep canvas; cyan accents for focus/tuning; Viridis as data palette

This spec should guide implementation without forcing risky rewrites. It aligns with PRD goals, leverages ADRs, and fits the current codebase structure.
