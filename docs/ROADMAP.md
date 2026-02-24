# rad.io Roadmap

## Phase 0: Product Definition & Success Gates

**Goal:** Ensure each engineering milestone maps to a user-visible win and measurable acceptance criteria.

### 0.A Success Gates (Must Not Churn)

These are gates, not features: they define what good means and prevent late-stage rewrites.

- [x] **Define MVP User Journeys**: connect source → see spectrum/waterfall → tune → listen → record → replay.
- [x] **Define Performance Budgets**: target 60 FPS visuals, predictable latency, CPU headroom for multi-VFO.
- [x] **Define Reliability Budgets**: tolerated drop rate, overrun behavior, recovery expectations.
- [x] **Define Test Strategy**: what is covered by unit tests vs simulated E2E vs real-device E2E.
- [x] **Define Support Matrix**: browsers/OS targets (e.g., Chrome/Edge on Windows first) + WebUSB/WebAudio constraints.
- [x] **Define Performance Regression Gates**: repeatable benchmarks for FPS, end-to-end latency, dropped-sample rate, and USB throughput/jitter.
- [x] **Define Time/Frequency Accuracy Budgets**: target PPM/drift bounds, “RF-accurate vs audio-stable” modes, and what is guaranteed for recordings/replay.
- [x] **Architecture Validation Spike**: prove the `WebUSB → Worker → WebAudio` critical path meets latency budgets on target hardware.
- [x] **CI/CD Pipeline & Quality Gates**: automate linting, testing, and performance regression checks on every commit.
- [x] **Data Privacy & Security Policy**: define handling of local recordings, settings, and device permissions.
- [x] **Operator Safety & Compliance Defaults**: define safe audio defaults, recording/monitoring UX guardrails, and provenance metadata expectations.
- [x] **Documentation Strategy**: establish processes for keeping architecture and requirements documentation in sync with code.

### 0.0 Product Discovery (De-risk Churn)

- [x] **Define Primary Personas + Jobs To Be Done**: “listener”, “RF explorer”, “diagnostics/support”, “measurement-lite”.
- [x] **Competitive/Reference App Review**: identify 5–10 reference receivers/analyzers and extract UX patterns worth copying/avoiding.
- [x] **Problem Statement + Success Metrics**: a crisp one-page statement + measurable success metrics (activation, retention proxy, crash-free sessions).
- [x] **MVP Demo Script (10 minutes)**: a repeatable, end-to-end demo that becomes the definition of “working”.
- [x] **Definition of Ready (Roadmap Items)**: minimum info required before implementing an item (acceptance, UX, telemetry, risks).

### 0.1 Scope & Success Definition (Must Not Churn)

- [x] **Define MVP Scope + Explicit Non-Goals**: lock MVP feature set, polish level, and what is deliberately excluded.
- [x] **Define “MVP Exit Checklist”**: a short acceptance checklist tied to user journeys + budgets (perf/reliability).

### 0.2 UX Foundations: Information Architecture & Interaction Contracts

- [x] **Information Architecture (IA) Map**: panels/navigation, what is always visible, and how users discover key actions.
- [x] **Connection UX Contract**: explicit UX for device pairing/claiming, streaming start/stop, and audio enablement (including recovery states and copy).
- [x] **Empty/Error State Catalog (MVP)**: define UI behavior for “no device”, “no signal”, “audio blocked”, “permission revoked”, “device busy”, “dropped samples”.
- [x] **Tuning Interaction Contract**: click/drag-to-tune semantics, wheel/keyboard stepping rules, direct frequency entry, and focus behavior.
- [x] **Receiver Mental Model Decision**: define and document semantics for center frequency vs tuned frequency vs span vs VFO.
- [x] **Frequency Planning / Artifact Awareness Contract**: define how the UI explains DC spur, images, and aliasing risk and what one-click mitigations are permitted (LO shift/IF shift, bandwidth clamp, rate change).

### 0.3 Design System Foundations (Tokens + Components + Accessibility)

- [x] **Design Tokens Spec**: CSS variables for spacing, typography scale, elevation, focus rings, and semantic colors. (`docs/design-system/design-tokens-spec.md`, `docs/design-system/token-naming-and-usage.md`)
- [x] **Core Component Spec Pack**: Button/Toggle, Slider, Numeric input (frequency), Dropdown, Tabs, Toast/Alert, Modal, Tooltip. (`docs/design-system/components/`)
- [x] **Accessibility-First Requirements (UX)**: keyboard-only flows for MVP, minimum contrast targets, reduced-motion behavior. (`docs/ux/accessibility/mvp-accessibility-requirements.md`, `docs/design-system/theme-contrast-requirements.md`, `docs/ux/accessibility/reduced-motion-and-animation-rules.md`)
- [x] **Interaction Prototype (Clickable)**: validate tuning + layout + safety flows before implementation (e.g., Figma prototype). (`docs/ux/prototypes/p0-interaction-prototype-brief.md`, `docs/ux/prototypes/p0-interaction-prototype-findings.md`)
- [x] **Keyboard Shortcut Map (Early)**: reserve key bindings for core ops (tune, step, start/stop, mute, record) to avoid rework. (`docs/reference/keyboard-shortcuts.md`)

### 0.4 Architecture “Irreversible Decisions” (ADRs)

- [x] **ADR: Worker Topology + Message Schema**: single vs multiple workers, schema versioning, and compatibility strategy.
- [x] **ADR: `SharedArrayBuffer` Strategy**: COOP/COEP requirements, fallback behavior, and feature degradations.
- [x] **ADR: State & Persistence Boundaries**: what lives in Zustand vs URL vs localStorage vs IndexedDB (including migrations).
- [x] **ADR: Error Taxonomy + User-Facing Error UX**: typed errors, retryability, and diagnostics bundle linkage.
- [x] **ADR: UI Architecture + Component Strategy**: state boundaries (UI vs DSP), component library approach (custom vs headless), and theming/token strategy.
- [x] **ADR: Plugin/Extension Boundary (Future-Proofing)**: define extension points and constraints even if plugins ship later.
- [x] **ADR: Source/DSP/Audio Sink Contracts**: explicit interfaces + versioning strategy (so Mock/File/WebUSB can share the pipeline).
- [x] **ADR: Runtime Schema Validation**: where/how to validate messages/state (e.g., Zod at boundaries) without perf cliffs.

### 0.5 Data/Telemetry Contracts (Before Implementation)

- [x] **Canonical Session State Shape**: device/tuning/demod/UI/perf settings model with a versioned schema.
- [x] **Telemetry Contract + Retention Window**: define counters/events required for budgets (drops, underruns, latency, USB stalls).
- [x] **Diagnostics Bundle Format (Versioned)**: structure, redaction/anonymization rules, and replay/debug expectations.
- [x] **Frequency Planning / LO Model Contract (Unified)**: define RF frequency vs tuner LO vs display frequency, plus LO/IF offsets and how they propagate into readouts, exports, and retune math.
- [x] **Calibration & Disclosure Contract (Measurement Claims)**: define what “uncalibrated/approx/calibrated” means for frequency and level, what evidence is required for “measurement-grade,” and how assumptions/uncertainty must be surfaced in UI and exports.
- [x] **RF Chain Model Contract (Structured)**: define the canonical schema for antenna/RF-chain/transverter context (LNA/attenuator/filter/bias-tee/IF offsets), where it is stored, and how it affects frequency/level mappings and diagnostics.

### 0.6 Risk Register + Validation Spikes (Timeboxed)

- [x] **Top Risks Register**: top ~10 risks with owner, mitigation plan, and acceptance validation.
- [x] **Spike Plan (2–3 Timeboxed Spikes)**: retire biggest unknowns (WebUSB stability/throughput, worker→audio latency, 60 FPS rendering).
- [x] **Definition of “Degraded Mode”**: agree on safe behavior when budgets are missed (mute ramps, lower FFT rate, reduced resolution).
- [x] **Secure Context + HTTPS Dev Plan (Windows)**: local cert strategy, localhost exceptions, and “how to run” guidance.
- [x] **Cross-Origin Isolation Deployment Plan**: ensure COOP/COEP headers in dev/prod and define the fallback feature set.

### 0.7 Project Hygiene & Execution System

- [x] **Definition of Done (PR/Issue)**: required checks, test updates, perf impact notes, ADR-needed rule. (`docs/process/definition-of-done.md`)
- [x] **Roadmap → Issues Policy**: every roadmap checkbox becomes an issue with acceptance criteria; epics get sub-issues. (`docs/process/roadmap-to-issues-policy.md`)
- [x] **Labeling/Ownership Conventions**: area labels (usb/dsp/audio/ui), risk tags, and owner expectations. (`docs/process/labels-and-ownership.md`)
- [x] **MVP Cutline + Sequencing Rules**: label items as Must/Should/Could and define “vertical slice first” sequencing for new subsystems. (`docs/process/mvp-cutline-and-sequencing.md`)

### 0.8 Preview/Release Strategy (Feedback Loop)

- [x] **Preview Distribution Plan**: how pre-release builds are shared and how feedback is collected and triaged. (`docs/release/preview-distribution.md`, `docs/release/preview-feedback-triage.md`)
- [x] **Versioning Policy for Fixtures/Recordings**: compatibility expectations for early users and regression assets.

### 0.9 Backlog, Release, and Change Management

- [x] **Issue Templates + Acceptance Criteria Template**: standardize bug/feature/driver issues so work stays testable and user-visible. (`docs/process/acceptance-criteria-template.md`, `.github/ISSUE_TEMPLATE/`)
- [x] **Release Checklist (MVP)**: versioning, changelog notes, migration notes, browser matrix, and “demo script passes” gate. (`docs/release/release-checklist-mvp.md`, `docs/release/changelog-policy.md`)
- [x] **Telemetry/Privacy Review Gate**: ensure diagnostics/telemetry items always include redaction rules and explicit user consent UX. (`docs/telemetry/privacy-review-checklist.md`)

## Phase 1: Foundation, Tooling & Observability

**Goal:** Maintain velocity while adding complex DSP + WebUSB + rendering.

### 1.1 Project Configuration

- [x] **App Skeleton (Vertical Slice Host)**: choose UI framework + bundler and ship a minimal running app shell.
- [x] **NPM Scripts as Contract**: standardize `start`, `build`, `test`, `lint`, `type-check`, `validate`.
- [x] **Repo Bootstrap Parity Check**: ensure VS Code tasks, package scripts, and README instructions are aligned (no “task exists but script missing”).
- [x] **Strict TypeScript Config**: keep `tsconfig.json` strict and avoid `any`.
- [x] **Test Infrastructure**: Vitest unit tests covering DSP contracts and critical UI state paths. (`src/**/*.test.ts`, `package.json`)
- [ ] **Cross-Browser Regression Gates (WebUSB/WebAudio)**: define a minimal browser matrix (Chrome/Edge stable + one canary) and block merges on known WebUSB/WebAudio regressions.
- [x] **Linting & Formatting**: ESLint + Prettier as hard gates.
- [x] **Build System**: Vite + TypeScript production build pipeline.
- [x] **Doc & ADR Folder Structure**: create `docs/decisions/` and define ADR template + numbering.

### 1.1.1 Vertical Slice Milestones (De-risk Integration)

- [x] **Vertical Slice A (No Hardware)**: MockSource → Worker → FFT/Waterfall → WFM mono audio out, measured latency and stability.
- [x] **Vertical Slice B (WebUSB Bring-Up)**: WebUSB device connect → sustained streaming → FFT/Waterfall, with drop counters and basic recovery.

### 1.2 Diagnostics & Supportability (Early)

- [x] **Error Handling**: typed error classes for source/device failures.
- [x] **Diagnostics Panel**: user-facing health view with actionable recommendations and connection-state contract progression (`idle`/`pairing`/`connected`/`streaming`/`recovering`/`error`). (`src/App.tsx`)
- [x] **RF Environment Context & Provenance (First-Class)**: capture antenna + RF chain context (preamp/attenuator/filter/bias-tee notes) and attach it to recordings, exports, and diagnostics. (`src/App.tsx` RF context panel + diagnostics/recording export payload)
- [x] **Structured RF Chain Model (Not Just Notes)**: represent RF chain elements (LNA/attenuator/filter/transverter/IF) as typed, queryable state so diagnostics and measurement disclosures can be computed rather than manually inferred. (`docs/reference/contracts/rf-chain-model-v1.md`, `src/App.tsx` diagnostics export)
- [ ] **IQ Integrity Wizard (“Bad IQ?”)**: detect IQ swap/invert/sign/scaling, DC offset, clipping, and sample-rate mismatch; offer one-click fixes and persist results into per-device profiles.
- [ ] **Hardware Bring-Up & Sanity Self-Test (Real Device)**: one-click checks for sample format/IQ ordering, DC offset magnitude, clock offset, gain-step effectiveness, and stream continuity; outputs a concise pass/fail report for support bundles.
- [ ] **Front-End Overload Triage (Actionable)**: guided actions like “reduce gain/enable attenuation/LO shift/narrow bandwidth” with short explanations and links to relevant diagnostics.
- [ ] **Dynamic Range / Linearity Check Mode (Actionable)**: quick tests to detect likely overload/intermod (noise-floor rise, spur density changes, “strong-signal” heuristics) and recommend RF chain changes (attenuation, LNA off, filter, LO offset).
- [ ] **Signal ID & Tuning Advisor (“What am I seeing?”)**: heuristic hints for likely signal class (AM/FM/narrowband/digital-ish/bursty), recommended demod + bandwidth, and warnings for common false signals (images, aliasing, DC spur, LO leakage).
- [x] **Diagnostics Bundle Export**: anonymized export for bug reports, with live status announcement on export completion. (`src/App.tsx`)
- [x] **Logging Discipline**: structured logs + throttling to avoid perf cliffs. (`src/App.tsx` diagnostics log schema, throttling window, structured export payload)
- [x] **WebUSB Runtime UX**: permissions, secure context requirements, “device already in use/claimed”, and reconnect flows after reload. (`src/App.tsx` runtime prerequisite panel + contention probe, `src/devices/HackRFDevice.ts` paired-device reuse)
- [x] **WebUSB Permission Lifecycle UX**: explicit “forget device / re-pair” flows, handle permission revocation, and recover from “device disappeared” without full refresh. (`src/App.tsx` forget flow + runtime disconnect handling)
- [x] **WebUSB Error Normalization (Actionable)**: map browser/WebUSB exceptions (stall, disconnect, NotFoundError/NetworkError, transfer errors) into typed, retryable user-facing errors with clear remediation. (`src/devices/errors.ts`, `src/devices/errors.test.ts`, `src/App.tsx`)
- [x] **Multi-Tab/Process Contention Handling**: detect when the device is claimed by another tab/app, coordinate across tabs, and surface actionable recovery steps. (`src/App.tsx` BroadcastChannel probe/claim checks)
- [x] **One-Click Support Bundle (Beyond Logs)**: export app/version, browser/OS, secure context + COOP/COEP/SAB status, permissions state, device identity/caps, current pipeline graph/config, and a short rolling telemetry window. (`src/App.tsx` diagnostics export payload)

### 1.2.1 Browser Runtime Prerequisites (Early)

- [x] **Cross-Origin Isolation Readiness (SAB)**: make COOP/COEP requirements explicit, detect when missing, and provide a tested fallback path (no-SAB) with clearly documented perf/latency tradeoffs. (`src/App.tsx`, `src/dsp/WorkerBridge.ts`, `vite.config.ts`, `vite.config.test.ts`)
- [x] **Secure Context & Permission Diagnostics**: surface “why WebUSB/SAB isn’t available” with actionable remediation (HTTPS, localhost exceptions, enterprise policies). (`src/App.tsx` health/runtime prerequisite panels)
- [ ] **Background Audio Reliability Strategy**: implement PWA keep-alive strategies and persistent workers to prevent audio stuttering/throttling when the tab is backgrounded or the screen is off.
- [x] **COOP/COEP Validation Test**: automated check that dev/prod responses include required headers when isolation is enabled. (`vite.config.test.ts`)

### 1.2.2 WebAudio Runtime Hardening (Early)

- [x] **Autoplay / Suspended AudioContext Recovery UX**: first-run and post-focus flows (“click to enable audio”), plus resilient recovery after sleep/wake and tab backgrounding. (`src/App.tsx` enable-audio action + visibility/focus resume, `src/audio/AudioSink.ts`)
- [x] **AudioWorklet Output Path (Preferred)**: implement an AudioWorklet-based sink with a measured fallback path and explicit perf/latency tradeoffs. (`src/audio/AudioSink.ts`, `public/wfm-processor.js`)
- [ ] **Sample-Rate Mismatch Strategy**: define how device IQ rates, DSP rates, and OS output rates interact; ensure stable behavior when output is forced to 48 kHz.
- [ ] **Click-Free Reconfiguration Contract**: guarantee pop/click suppression on start/stop, retune, bandwidth changes, and output device changes (bounded ramp + discontinuity events).

### 1.3 Health Telemetry (Not Just Logs)

- [x] **Pipeline Telemetry**: per-stage timing, end-to-end latency, and CPU budget utilization. (`src/dsp/worker.ts` timing emission, `src/telemetry/runtimeTelemetryContract.ts`, `src/App.tsx` runtime metrics)
- [ ] **Buffer Telemetry**: buffer occupancy graphs + underrun/overrun counters across USB → DSP → audio.
- [x] **USB Telemetry**: transfer rate, jitter, retry/stall counters, and dropped-transfer visibility. (`src/devices/HackRFDevice.ts`, `src/devices/ISDRDevice.ts`, `src/App.tsx` runtime metrics + diagnostics export)
- [ ] **USB Transfer Scheduling Telemetry**: measure transfer size/cadence effects (short packets, burstiness, controller quirks) and surface recommended “streaming profiles”.
- [x] **Audio Telemetry**: audio underrun counters and “muted due to safety” events surfaced to UI. (`src/audio/AudioSink.ts`, `src/telemetry/runtimeTelemetryContract.ts`, `src/App.tsx` runtime metrics/health)
- [x] **Audio Clock / Drift Telemetry**: track audio callback jitter, resampler ratio changes, and “audio clock vs sample clock” divergence to support long sessions. (`src/telemetry/runtimeTelemetryContract.ts`, `src/App.tsx` runtime metrics + diagnostics export)
- [ ] **RF Impurity Telemetry**: track DC spur level, estimated image rejection/IQ imbalance, LO leakage indicators, and spur density/overload heuristics and surface them in diagnostics.
- [ ] **Timebase & Drift Telemetry**: estimate sample-rate error, resampler ratio/PLL state (if used), and long-run drift indicators for “hours-long stability” support.
- [ ] **Front-End Health Indicators**: surface clipping/overrange, effective SNR/ENOB heuristics, and band-aware “try attenuator/LNA/filter/hub/cable” suggestions.

### 1.4 Session Resilience & Latency Controls

- [ ] **Suspend/Resume Resilience**: handle tab reload, sleep/wake, and mid-stream disconnects with clear UX and safe defaults.
- [ ] **Audio Output Device Selection**: choose output device and handle hot-swaps without requiring a full restart.
- [x] **Latency/Buffer Controls**: user-facing presets (e.g., “Low Latency” vs “Stable”) with explicit tradeoffs and persisted preference. (`src/App.tsx`, `src/dsp/worker.ts`, `src/dsp/AudioPllController.ts`)
- [ ] **Adaptive Streaming Policy**: dynamically adjust USB transfer sizing / buffering / scheduling based on rate and CPU pressure, with explicit “degraded mode” behavior.
- [ ] **RF vs Audio Clock Sync Policy**: explicit modes and tradeoffs (e.g., “RF-accurate” timebase correction vs “audio-stable” listening), persisted and reflected in diagnostics.
- [x] **Shareable Session State (Safe)**: URL/state export for reproducible bug reports and “open this tuned view” sharing without leaking private data. (`src/measurements/shareableSessionState.ts`, `src/measurements/shareableSessionState.test.ts`, `src/App.tsx`)
- [ ] **Command Palette / Keyboard Ops**: fast receiver operations (tune, mode, bandwidth, start/stop, record) without UI hunting.
- [ ] **Safe Mode Boot (Crash/Perf Recovery)**: if last session ended badly (crash, runaway CPU, repeated disconnect), auto-start with minimal pipeline + no auto-connect and offer a guided restore.
- [x] **Browser Lifecycle Choreography (Device + Audio)**: explicitly define and harden behavior for focus/visibility changes, sleep/wake, audio suspension, device disappear/re-enumerate, and background throttling. (`src/App.tsx` visibility/focus handlers + USB disconnect recovery)
- [ ] **Crash-Only Pipeline Recovery**: if a Worker/AudioWorklet fails, automatically restart into a safe minimal pipeline and preserve a support-bundle breadcrumb trail.
- [x] **Session Trust Indicator**: surface “Measurement-grade vs Listening-grade vs Degraded” status derived from telemetry (drops, underruns, missing isolation, unstable clock) with actionable guidance. (`src/App.tsx`, diagnostics export `sessionTrust`)
- [ ] **Session Grade Upgrade Flow (Guided)**: guided steps to become “measurement-grade” (stability window with zero drops, calibration presence, isolation status, known-good device profile) and to “lock” a session for reproducible exports.
- [x] **Session Provenance Timeline (Exportable)**: record key parameter changes + discontinuities with timestamps (“what changed when”) and include in diagnostics bundles and recording metadata. (`src/measurements/sessionProvenanceTimeline.ts`, `src/App.tsx` diagnostics export)
- [ ] **Recording/Export Integrity Validator**: validate artifacts before export (sample counts, timestamps monotonic, discontinuities accounted for, calibration snapshot present) and stamp outputs with a trust grade + warnings.

### 1.5 WebUSB Debug Harness (Supportability)

- [x] **USB Trace Capture (App-Level)**: capture control/bulk timing, stalls, short packets, and retry events into a shareable diagnostics artifact. (`src/devices/HackRFDevice.ts`, `src/App.tsx` diagnostics export)
- [x] **USB Descriptor/Endpoint Inspector (Read-Only)**: show chosen configuration/interface/alt-setting/endpoints with warnings for unexpected firmware/board variants. (`src/devices/HackRFDevice.ts`, `src/App.tsx` runtime metrics)
- [x] **USB Streaming Profile Capture**: persist the active transfer sizing/scheduling policy and controller hints into diagnostics bundles for reproducible support. (`src/devices/HackRFDevice.ts`, `src/App.tsx` diagnostics export)
- [ ] **USB Streaming Profile Auto-Tuner (Measured)**: automatically try a bounded set of transfer sizes/counts and recommend a stable profile based on drop rate/jitter/CPU, storing results per controller/hub.
- [ ] **USB Trace Replay (Sim)**: replay captured USB-level behavior into simulated runs to reproduce WebUSB flakiness deterministically.
- [x] **Repro Bundle Completeness**: export a single artifact including settings snapshot, device identity/caps, app/version, discontinuity timeline, and selected USB trace slices for deterministic replay. (`src/App.tsx` diagnostics `reproBundle`)
- [ ] **USB Chaos / Fault Injection (Sim)**: deterministic scenarios for stalls, short packets, device resets mid-stream, and “endpoint halt storms” to harden recovery logic.

## Phase 2: Deterministic Sources (No Hardware Required)

**Goal:** Make the core receiver experience work end-to-end without WebUSB, so DSP/UI iteration is unblocked.

### 2.1 Mock Source

- [x] **`MockDevice` Implementation**: synthetic IQ (noise + tones + modulated test signals).
- [x] **Stream Control**: start/stop streaming with configurable sample rates.
- [x] **Verification**: unit tests that validate known signals are produced.
- [x] **IQ Integrity Self-Test**: automated checks for IQ ordering/sign/scaling (and swapped/inverted quadrature detection) using known synthetic tones and fixtures.

### 2.2 File Source + Golden Fixtures

- [x] **SigMF Replay**: implement `FileDevice` for deterministic IQ playback.
- [x] **SigMF Test Vectors**: maintain canonical recordings for regression tests.
- [x] **Golden Output Tests**: toleranced expectations for filters/demods/AGC.
- [x] **Known-Signal Fixture Library**: canonical IQ clips for FM pilot, AM carrier, NFM tone, NOAA WX, time beacons, and “clean tone in noise” baselines.
- [x] **End-to-End Accuracy Tests**: fixtures validate frequency error, demod lock behavior, and meter stability across retunes and long runs.
- [x] **Calibrated Fixture Metadata**: ship fixtures with known levels/frequency offsets where possible so metering, PPM, and “measurement mode” can be regression-tested (with tolerances).
- [x] **Interop Fixture Exports (Golden)**: for each canonical fixture, ship/reference exports in common interchange forms (SigMF + raw IQ sidecar, WAV audio renders) to validate import/export correctness and prevent ecosystem regressions.

### 2.3 Timestamp / Sequence Model (Foundational)

- [x] **Timestamp Model**: consistent timestamp/sequence for buffers (derived or device-provided).
- [x] **Sample Clock Truth Modes (Testable)**: define “unknown / corrected (PPM) / disciplined (ref)” modes and how each mode constrains UI readouts and export claims.
- [x] **Dropped Sample Detection**: detect gaps and backpressure and surface it to the UI.
- [x] **Discontinuity Event Model**: explicitly represent retunes, device resets, overruns, and stream restarts and propagate them through DSP → UI → recording/export metadata timeline.
- [x] **Monotonic Timebase Invariants (All Sources)**: enforce and regression-test timestamp/sequence/sample-count invariants for Mock/File/WebUSB sources and for replay. (Mock/File/replay covered by conformance + long-run regressions; HackRF WebUSB source now emits stream-frame metadata and was runtime-verified via Playwright diagnostics export.)
- [x] **Wall-Clock Recording Timestamps**: persist real-world time metadata (when available) alongside sample-time for recordings/replay.
- [x] **Settings + Measurement Provenance**: persist “where measurements are taken” metadata (ADC vs post-DDC vs post-demod) so metering is repeatable and debug-friendly.
- [x] **RF↔Audio Timebase Alignment Model**: baseline model + export metadata mapping implemented and tested for deterministic sources (`src/measurements/rfAudioTimebaseAlignment.ts`, `docs/reference/rf-audio-timebase-alignment-baseline.md`).
- [x] **Long-Run Drift Regression Tests**: simulated multi-hour deterministic regressions with suspend/resume gaps validate monotonic invariants and bounded sample-time drift (`src/devices/longRunDriftRegression.test.ts`).

### 2.4 Measurement & Reproducibility Foundations (Foundational)

- [x] **Measurement Uncertainty Model**: formalize “dBFS vs approximate dBm,” calibration presence, and uncertainty bounds; propagate into UI readouts and exports.
- [x] **Calibration Confidence & Disclosure UX**: visibly indicate calibration presence/quality (e.g., “uncalibrated/approx/calibrated”) on meters and exports, and persist it in artifacts for reproducibility.
- [x] **Analyzer Artifact Export (Deterministic)**: export analyzer state (FFT/window/ENBW/averaging/ref level conventions), calibration snapshot, and pipeline graph/config so bugs and measurements are reproducible.
- [x] **Time Alignment Extensions (Optional)**: baseline optional metadata (`timeAlignment.referenceDiscipline`, including `1pps`) propagates through fixture schema + interop/export metadata.

### 2.5 Deterministic “RF Scenarios” (Regression)

- [x] **Scenario Fixtures**: scripted deterministic events (retune, gain step, clock step, sample-rate step, backpressure) with regressions for deterministic sources (`src/fixtures/scenarios/scriptedRfScenarios.ts`, `src/devices/scenarioFixtures.test.ts`).
- [x] **Recovery Regression Tests**: validate dropout concealment + pop suppression behavior and verify counters/telemetry increment as expected.
- [x] **Interference Scenarios**: deterministic DC spike, single-tone heterodyne, mains hum, and impulsive noise fixtures to regression-test mitigation presets.
- [x] **Discontinuity Fuzz/Property Tests**: randomized start/stop/retune/backpressure sequences that must preserve invariants (no crashes, bounded latency growth, correct discontinuity event emission).

## Phase 3: Core DSP Pipeline (Workers → Audio → Demods)

**Goal:** A stable processing chain that can demodulate common analog signals with good UX.

### 3.1 Worker Infrastructure

- [x] **Worker Setup**: main DSP worker + message passing.
- [x] **SharedArrayBuffer**: zero-copy path where available.
- [x] **Fallback Mode**: `MessageChannel` fallback. (`src/dsp/WorkerBridge.ts`, `src/dsp/WorkerBridge.test.ts`, `src/App.tsx`)

### 3.2 Processing Pipeline

- [x] **Pipeline Architecture**: define the chain: `Source → DDC/Filter → Demod → Sink`.
- [x] **NCO / Mixer (DDC)**: frequency shift for tuning and channel extraction.
- [x] **Multi-VFO Channel Extraction Layer**: phase-coherent per-VFO extraction (1–2 VFOs) and PFB channelizer mode (3+ VFOs). (`src/dsp/MultiVfoChannelizer.ts`, `src/dsp/MultiVfoChannelizer.test.ts`, `src/dsp/worker.ts`, `src/App.tsx`)
- [x] **Channelizer/Decimator Correctness Contract**: define and test phase coherence + group delay guarantees (esp. PFB/multi-VFO) with regression fixtures. (`src/dsp/MultiVfoChannelizer.test.ts`, `src/dsp/Downsampler.test.ts`)
- [x] **Frequency / Clock Error Correction (PPM)**: apply PPM correction in the DSP path (not just UI), with stable behavior across retunes. (`src/dsp/ppmCorrection.ts`, `src/dsp/worker.ts`, `src/App.tsx`, `src/dsp/ppmCorrection.test.ts`)
- [x] **Drift Estimation + Confidence**: estimate LO/sample-clock drift over time from pilots/beacons, surface confidence, and feed it into calibration/AFC decisions. (`src/dsp/FrequencyTracker.ts`, `src/dsp/worker.ts`, `src/App.tsx`, `src/dsp/FrequencyTracker.test.ts`)
- [x] **Frequency Accuracy Model (Unified)**: define a single model for PPM + AFC/PLL lock state + drift estimate and propagate it through UI, recording metadata, and replay so frequency correctness is explainable and reproducible. (`src/dsp/FrequencyTracker.ts`, `src/dsp/AudioPllController.ts`, `src/dsp/worker.ts`, `src/App.tsx`, `src/dsp/analyzerArtifactExport.ts`)
- [x] **Stability/Phase-Noise Characterization Mode (Guardrailed)**: quantify short-term stability using pilots/beacons (phase error metrics) and persist results into device profiles. (`src/dsp/FrequencyTracker.ts`, `src/dsp/worker.ts`, `src/App.tsx`, `src/devices/deviceProfileStore.ts`)
- [x] **IQ Correction**: baseline per-frame DC removal + I/Q gain-balance correction stage integrated into worker DDC path. (`src/dsp/IqCorrection.ts`, `src/dsp/worker.ts`, `src/dsp/IqCorrection.test.ts`)
- [x] **RF Impurity Mitigation UX Hooks**: expose measurable controls for LO/IF shift (fine tune), configurable notch frequency/Q, and IQ correction enablement with safe defaults and runtime diagnostics context. (`src/App.tsx`, `src/dsp/controlGuardrails.ts`, `src/dsp/IqCorrection.ts`, `src/dsp/worker.ts`)
- [x] **Minimal Interference Mitigation Presets (Early)**: deterministic “DC spike reduction”, “heterodyne notch”, and “hum notch” presets with measurable before/after indicators. (`src/dsp/AudioPostProcessor.ts`, `src/dsp/AudioPostProcessor.test.ts`, `src/App.tsx`)
- [x] **Decimation**: efficient downsampling filters.
- [x] **Resampling**: polyphase resampler (IQ + audio rate). (`src/dsp/PolyphaseResampler.ts`, `src/dsp/worker.ts`, `src/dsp/PolyphaseResampler.test.ts`)
- [x] **Asynchronous SRC / Audio PLL**: lock audio output to device/sample time with explicit stability/latency tradeoffs and telemetry hooks. (`src/dsp/AudioPllController.ts`, `src/dsp/worker.ts`, `src/App.tsx`, `src/dsp/AudioPllController.test.ts`)
- [x] **Anti-Alias Guarantees**: mode filter constraints now include live sample-rate guard bands; fine-tune and high-cut controls are clamped by alias-safe limits at runtime. (`src/dsp/controlGuardrails.ts`, `src/App.tsx`, `src/dsp/controlGuardrails.test.ts`)
- [x] **Auto Rate/Decimation Planning**: mode/bandwidth-aware stream-rate planner selects source sample rate and decimation factor, and runtime applies plan to device/worker with diagnostics. (`src/dsp/controlGuardrails.ts`, `src/App.tsx`, `src/dsp/Downsampler.ts`, `src/dsp/controlGuardrails.test.ts`)
- [x] **Constraint-Driven UI**: UI now surfaces alias-safe limits and planned stream/decimation state, while control interactions enforce valid combinations under active sample-rate constraints. (`src/App.tsx`, `src/dsp/controlGuardrails.ts`)
- [x] **Audio Safety**: limiter/soft-clipper to avoid clipping. (`src/audio/AudioSink.ts`, `src/audio/AudioSink.test.ts`)
- [x] **Audio Leveling (Early)**: deterministic post-demod audio leveler with operator toggle and live gain-state telemetry (`enabled`, linear gain, dB gain) surfaced to UI for “active/not-active” visibility. (`src/dsp/AudioLeveler.ts`, `src/dsp/worker.ts`, `src/App.tsx`, `src/dsp/AudioLeveler.test.ts`)
- [x] **AGC Contract (Per-Mode, Testable)**: baseline BB AGC with per-mode targets, attack/release, squelch-aware hold behavior, UI control, and contract telemetry (`idle`/`tracking`/`hold`) plus tests. (`src/dsp/AudioAgc.ts`, `src/dsp/AudioAgc.test.ts`, `src/dsp/worker.ts`, `src/App.tsx`, `src/telemetry/runtimeTelemetryContract.ts`)
- [x] **Hard Audio Safety UX**: startup muted, per-mode default gain staging, configurable max output level, and an always-available “panic mute” action (keyboard + UI). (`src/App.tsx`, `src/audio/AudioSink.ts`)
- [x] **Impulse Noise Blanker (Baseline, Early)**: deterministic blanker stage with operator toggle and runtime blanking telemetry (blanked samples, ratio, impulse energy), covered by unit tests. (`src/dsp/ImpulseBlanker.ts`, `src/dsp/ImpulseBlanker.test.ts`, `src/dsp/worker.ts`, `src/App.tsx`)
- [x] **Front-End Overload/Intermod Heuristics**: health-panel heuristic now detects likely overload/intermod from FFT peak + elevated spur density and surfaces gain-staging guidance. (`src/App.tsx`)
- [x] **Audio Pop/Click Suppression**: fade-in/out on start/stop/mute/unmute and on parameter jumps. (Extended with underrun concealment splice + ramped recovery in `src/audio/AudioSink.ts`.)
- [x] **Filter Shapes & Bandwidth Control**: per-mode filter defaults + user-selectable bandwidths. (`src/dsp/AudioPostProcessor.ts`, `src/App.tsx`)
- [x] **Filter Profiles**: sharp vs low-latency vs low-ringing profiles (mode-dependent) with clear UX tradeoffs. (`src/dsp/AudioPostProcessor.ts`, `src/App.tsx`)
- [x] **Dropout / Sample-Loss Concealment**: deterministic policy for gaps (mute ramps, timebase correction, re-lock) beyond just counting drops. (`src/audio/AudioSink.ts`, `src/devices/recoveryRegression.test.ts`, `src/audio/AudioSink.test.ts`)
- [x] **Carrier Tracking (AFC/PLL)**: optional per-mode tracking to correct residual frequency error and long-session drift (especially NFM/SSB). (`src/dsp/FrequencyTracker.ts`, `src/dsp/worker.ts`, `src/App.tsx`)
- [x] **Explicit Lock States**: expose lock/quality state machines (e.g., WFM pilot lock, AM carrier lock) so UX can drive retune-assist and safe recovery. (`src/dsp/DemodMetrics.ts`, `src/App.tsx`)
- [x] **Audio Filter Controls**: per-mode high/low cut and optional notch helpers for intelligibility (SSB/AM/NFM). (Baseline controls delivered for WFM/AM/NFM shared path via `src/App.tsx` + `src/dsp/AudioPostProcessor.ts`.)
- [x] **DSP Amplitude Contract**: explicitly define IQ scaling and normalization at key tap points (pre/post-DDC, post-demod) so meters, FFT, recording, and exports are consistent across devices. (`src/telemetry/runtimeTelemetryContract.ts`, `src/dsp/worker.ts`, `src/telemetry/runtimeTelemetryContract.test.ts`)

### 3.3 “Must-Have” Demodulators (Product Loop)

- [x] **WFM Demodulator**: mono + de-emphasis (50/75 µs).
- [x] **WFM Stereo + RDS (Early)**: pilot/stereo decode + baseline RDS/RBDS decode and UI. (`src/dsp/WfmStereoDecoder.ts`, `src/dsp/WfmStereoDecoder.test.ts`, `src/dsp/worker.ts`, `src/App.tsx`, `src/dsp/RdsDecoder.ts`)
- [x] **AM Demodulator**: broadcast/airband baseline.
- [x] **AM Sync (SAM)**: synchronous AM demod for selective fading and improved intelligibility (Core Pro Feature). (`src/dsp/SamDemodulator.ts`, `src/dsp/SamDemodulator.test.ts`, `src/dsp/worker.ts`, `src/App.tsx`)
- [x] **NFM Demodulator**: voice channels baseline.
- [x] **NFM De-Emphasis + Audio Shaping Presets (Deterministic)**: optional time-constant presets (`75us`, `50us`, `off/flat`) plus voice/discriminator path selection for deterministic NFM workflows. (`src/dsp/NfmDemodulator.ts`, `src/dsp/worker.ts`, `src/App.tsx`, `src/dsp/NfmDemodulator.test.ts`)
- [x] **SSB Demodulator**: USB/LSB with BFO. (`src/dsp/SsbDemodulator.ts`, `src/dsp/SsbDemodulator.test.ts`, `src/dsp/worker.ts`, `src/App.tsx`)
- [x] **CW Demodulator**: BFO + narrow filter defaults and clean tuning UX (center/offset, optional pitch). (`src/dsp/CwDemodulator.ts`, `src/dsp/CwDemodulator.test.ts`, `src/dsp/worker.ts`, `src/App.tsx`)
- [x] **Basic AFSK/FSK Audio Path (No Decode Yet)**: stable NFM discriminator audio path exposed in UI (`Voice` vs `Discriminator`) for external decoder workflows and future plugin decode stages. (`src/dsp/NfmDemodulator.ts`, `src/dsp/worker.ts`, `src/App.tsx`)
- [x] **Verification**: use Mock/File sources to validate audio output quality. (`src/dsp/demodGoldenFixtures.test.ts`, `src/dsp/endToEndAccuracy.test.ts`)
- [x] **Demod Quality Metrics**: mode-specific lock/quality indicators (e.g., FM deviation estimate, WFM pilot lock, AM carrier lock) surfaced to telemetry/UI. (`src/dsp/DemodMetrics.ts`, `src/dsp/DemodMetrics.test.ts`, `src/App.tsx`)

### 3.4 Squelch (After Basic Audio Works)

- [x] **Noise Squelch**: SNR-based squelch with hysteresis/gated audio path and operator threshold control. (`src/dsp/NoiseSquelch.ts`, `src/dsp/worker.ts`, `src/App.tsx`, `src/dsp/NoiseSquelch.test.ts`)
- [x] **CTCSS/DCS (Optional)**: sub-tone detection. (Deterministic CTCSS + DCS presence and baseline DCS codeword decode with confidence and operator-selectable mode (`OFF`/`CTCSS`/`DCS`/`AUTO`) via `src/dsp/ToneDecoder.ts`, `src/dsp/ToneDecoder.test.ts`, `src/dsp/worker.ts`, and `src/App.tsx`.)
- [x] **Scanner-Grade Squelch Behavior**: hang time, tail suppression, and dwell semantics for scanning workflows. (Hang/tail state machine and operator controls in `src/dsp/NoiseSquelch.ts`; scan dwell semantics integrated into FM scan workflow with operator-configurable dwell control in `src/App.tsx`.)

## Phase 4: Visualization & Interaction MVP

**Goal:** Make the app feel like a “real receiver” early; visuals and tuning UX drive adoption.

### 4.0 Kickoff Plan (Prepared 2026-02-24)

- [ ] **Kickoff Slice A: Analyzer Baseline Controls**: implement reference level + averaging + peak-hold with deterministic behavior and tests.
- [ ] **Kickoff Slice B: Signal Discovery Helpers**: add center-on-peak and snap-to-signal actions with keyboard and click affordances.
- [ ] **Kickoff Slice C: Marker MVP**: single marker with frequency/power readout and tune-to-marker action.
- [ ] **Kickoff Slice D: FPS Validation Gate**: add repeatable synthetic-render test and record sustained `>= 60 FPS` evidence.
- [ ] **Kickoff Slice E: Interaction Guardrails**: add keyboard-first step tuning parity and retune-assist lock return behavior.
- [ ] **Kickoff Readiness Review**: convert 4.0 slices into issues with acceptance criteria per `docs/process/acceptance-criteria-template.md` and link them back into this section.
- [x] **Kickoff Plan Documented**: issue-ready sequencing, scope, and acceptance criteria are defined in `docs/roadmap/04_VISUALIZATION_INTERACTION_MVP/PHASE4_KICKOFF_2026-02-24.md`.

### 4.1 Design System

- [ ] **Theme Setup**: CSS variables for “Professional” theme.
- [ ] **Core Components**: Button, Slider, Card, etc.

### 4.2 Rendering

- [ ] **Canvas/WebGL Context**: robust setup and resizing.
- [x] **Spectrum View**: FFT rendering.
- [x] **Waterfall View**: scrolling waterfall with colormaps.
- [ ] **Verification**: sustain 60 FPS on synthetic input.

### 4.3 Analyzer Controls (MVP)

- [ ] **Spectrum Controls**: window selection, averaging (linear/exp), peak-hold/max-hold, reference level.
- [ ] **Signal Discovery Helpers (MVP)**: peak picking, occupied bandwidth estimation, and quick actions like “center-on-peak” and “snap-to-signal” based on trace features.
- [ ] **Signal Type Hints + False-Signal Warnings (MVP)**: annotate likely artifacts (images, aliasing risk, DC/LO spurs) and provide “why” tooltips + one-click mitigations (LO shift, bandwidth clamp, notch presets).
- [ ] **Candidate Signal Stats (MVP)**: lightweight stats (noise floor estimate, SNR estimate, persistence/occupancy hints) to drive retune assist and user guidance.
- [ ] **Analyzer Semantics (Early)**: RBW/VBW-style controls, detector modes (sample/peak/RMS/avg), and ENBW-aware scaling so measurements are repeatable.
- [ ] **Detector Extensions (Practical)**: add min-hold and percentile (e.g., P95) detectors for occupancy/weak-signal work with defined semantics.
- [ ] **Trace Normalization & Math**: explicit dBFS conventions, trace math (A/B/max), and clear “what does this number mean?” UI.
- [ ] **FFT Scaling Contract (End-to-End)**: formalize FFT bin scaling, window ENBW handling, and dBFS reference so on-screen levels match exported measurements and don’t vary by device.
- [ ] **Noise Floor Estimator Contract (ENBW-Aware)**: define a robust estimator method (e.g., percentile/trimmed mean) and ensure it matches exported analyzer artifacts.
- [ ] **Waterfall Inspection**: freeze + cursor readouts over historical bins; dynamic range clamp.
- [ ] **Analyzer Exports (MVP)**: export trace(s), marker tables, and key analyzer settings (RBW/VBW, window/ENBW, detector, ref level) as a reproducible artifact.
- [ ] **Marker/VFO Quick Capture (One-Click)**: export a short IQ/audio snippet “around this marker/VFO” with required metadata (rate/frequency/PPM/offsets/discontinuities) for external-tool workflows.
- [ ] **Marker Table Workflow (Pro)**: peak table w/ sort/filter, “tune VFO to marker”, and marker↔VFO binding for repeatable analysis.
- [x] **FM Band Auto-Scan (Baseline)**: software tune-step-settle-measure scan across 87.5-108.0 MHz with candidate ranking and RDS-assisted station labeling.
- [ ] **Sweep/Stitch Analyzer Mode**: device-agnostic sweep (tune-step-settle-measure) + stitching, with HackRF hardware sweep fast-path where available.
- [ ] **Spur / Artifact Annotation Layer (Early)**: allow marking and labeling known spurs/artifacts (device/internal/external) and optionally mask them in measurement/export outputs.

### 4.4 Interaction

- [x] **Tuning Interaction**: click/drag-to-tune (Click-to-tune implemented).
- [ ] **Retune Assist**: center-on-peak, snap-to-raster, pilot/carrier “lock retune”, and “return to last locked” for drift-prone sessions.
- [x] **Zoom & Pan**: smooth frequency navigation.
- [ ] **Markers/Cursors (Early)**: basic markers to support workflows and debugging.
- [ ] **Marker↔VFO Binding Controls**: explicit “bind this marker to active VFO” and “follow VFO” modes with clear affordances.
- [ ] **Delta Markers + Peak Readout**: delta frequency/power readouts and a simple peak list for “find the signal” workflows.
- [ ] **Band Plans & Stepping**: regional band presets, channel raster snapping, and per-mode step sizes.
- [ ] **Band-Aware Defaults & Constraints (Guardrails)**: enforce alias-safe bandwidth limits, region-appropriate defaults (e.g., de-emphasis), and warning prompts when settings are likely invalid for the selected band/mode.
- [ ] **Keyboard-First Tuning**: fast step up/down, direct frequency entry, and quick mode/bandwidth controls.
- [ ] **History & Recall**: last-tuned list, last-heard list, and quick A/B recall to support exploration workflows.
- [ ] **Frequency Mapping / Transverter Support**: separate “RF frequency” vs “tuner LO” vs “display frequency” with per-band offsets/profiles (up/downconverters, IF sampling workflows).

### 4.5 Debug & Signal Views (High-Leverage)

- [ ] **I/Q Scope View**: time-domain I/Q oscilloscope to debug DC offset, clipping, and phase issues quickly.
- [ ] **Constellation View**: scatter/constellation visualization for IQ integrity checks and future digital-mode bring-up.

## Phase 5: Device Abstraction + Hardware Enablement

**Goal:** Add real devices once the core pipeline is already correct and observable.

### 5.1 Device Interface & Capabilities

- [ ] **`ISDRDevice` Interface**: open/close/tune/stream contract.
- [ ] **Capabilities Model**: gain stages, AGC, filters, amp, bias-tee, clocking.
- [ ] **Capability Negotiation Algorithm (Safe Defaults)**: choose rate/bandwidth/gain/streaming profile with an explainable decision trace and deterministic reapply on reconnect.
- [ ] **Gain Stage Ordering & Validation**: device-specific gain constraints (order, ranges, coupling) with UI guidance and safe clamping.
- [ ] **IQ Conventions & Toggles**: IQ swap/invert controls and explicit sample-format conventions per device.
- [ ] **DC/Front-End Correction Toggles**: device-side DC offset correction options (when supported) surfaced consistently.
- [ ] **Bias-Tee / Antenna Power Safety**: explicit “power on” controls with warnings/timeouts where applicable.
- [ ] **External IO / GPIO Control**: Interface for controlling device GPIO pins (antenna switching, external filters/LNAs).
- [ ] **Analog Bandwidth / Baseband Filter Awareness**: expose usable analog bandwidth and any device-side baseband filter selections.
- [ ] **Front-End Controls**: per-device gain staging and toggles.
- [ ] **LO Offset / IF Shift**: mitigate DC spike and LO artifacts.
- [ ] **Sample-Format Normalization Contract**: explicit scaling/signedness/IQ order conventions and invariant tests so DSP stays device-agnostic.
- [ ] **Per-Device Sample-Format Fixtures**: conformance fixtures per driver covering signedness, endian, interleaving, saturation/clipping behavior, and IQ swap/invert to prevent subtle device-specific regressions.
- [ ] **`ISDRDevice` Conformance Suite**: required tests for all drivers (stream continuity, timestamp/sequence rules, and recovery semantics).
- [ ] **Timestamp/Continuity Conformance Gates (Hard)**: explicitly validate sample-count continuity, gap sizing invariants, and retune discontinuity semantics across drivers.
- [ ] **Descriptor/Endpoint Robustness**: resilient discovery of interfaces/alt-settings/endpoints across firmware/board variants with clear compatibility warnings.
- [ ] **Compatibility Gating (Known-Good Profiles)**: detect firmware/board variants and gate/disable unsupported features with clear guidance and safe defaults.
- [ ] **Device State Machine Spec (Driver Contract)**: explicitly define open/claimed/streaming/stalled/recovering/resetting states and required transitions + events.
- [ ] **Stream Continuity Contract (Driver Contract)**: specify which operations are glitchless vs discontinuity-causing; require discontinuity events with cause codes for retune/gain/rate changes.

### 5.2 Identity, Persistence, and Safety

- [ ] **Stable Device Identity**: persist per-device identifiers for settings/reconnect.
- [ ] **Stable Identity Fallback Strategy**: define identity derivation when USB serial is missing/blank (common), and how it impacts profiles, reconnect, and diagnostics.
- [ ] **Per-Device Profiles**: “apply on connect” profiles (rate/gains/PPM/etc).
- [ ] **Session Restore Hooks**: safe best-effort restore + user confirmation for risky settings.
- [ ] **Clipping/Overrange Detection**: warn + guide gain staging.
- [ ] **Gain Staging Guidance**: safe defaults + band presets.
- [ ] **Gain Staging Assistant**: guided “optimize for no clipping + target noise floor” workflow using live metrics and device constraints.
- [ ] **Calibration UX (Per-Device)**: PPM correction workflow + drift visibility (and safe defaults when unknown).
- [ ] **Frequency Calibration Wizard**: beacon-based workflow that produces stored PPM + drift estimate and confidence.
- [ ] **Known-Signal Calibration Sources (Practical)**: support calibration flows using common references (e.g., WFM pilot, NOAA carriers, WWV/CHU time beacons, lab signal generator) with explicit prerequisites and confidence scoring.
- [ ] **Amplitude Calibration Storage**: per-device/per-band calibration blobs (gain vs frequency, baseline noise estimates) to support approximate dBFS→dBm mapping with disclaimers.
- [ ] **Level Calibration Wizard (Quasi-Absolute)**: guided workflow to map dBFS → approximate dBm/dBµV using known reference sources and RF chain context, producing an uncertainty bound that propagates into meters/exports.
- [ ] **Band-Specific Calibration Profiles**: separate HF/VHF/UHF calibration offsets and presets (with import/export) to reduce “one knob fits all” error.
- [ ] **Clock/Timebase Model**: define how sample-clock drift and discontinuities are represented and propagated into DSP + UI.
- [ ] **Reference Clock Support (Bring Model Forward)**: represent internal vs external 10 MHz reference (when supported), integrate into PPM/AFC semantics, and include it in diagnostics bundles.
- [ ] **Reference Lock UX (Visibility + Propagation)**: when supported, detect and surface reference presence/lock/confidence and propagate it into recordings and exports (so frequency claims remain explainable).
- [ ] **Reference Lock “Prove It” Flow**: guided stability check (time window + confidence) so “measurement-grade” claims can require demonstrated lock/stability.
- [ ] **Overload/Clipping Telemetry**: device/DSP-side clipping/overrange detection wired into diagnostics with actionable guidance.
- [ ] **Antenna / Front-End Context Profiles**: persist antenna name + external preamp/attenuator/filter/bias-tee notes alongside device profiles and include them in diagnostics bundles for actionable support.
- [ ] **RF Chain Profiles (Typed + Reusable)**: named, reusable RF chain configs (attenuator/LNA/filter/transverter/IF offsets) that can be applied per device/band and automatically reflected in measurement disclosures and tuning math.
- [ ] **Spur/LO Artifact Catalog (Per-Device)**: maintain a per-device/per-rate/per-gain “known internal artifact” catalog to prevent false signal attribution and improve supportability.
- [ ] **Hearing Safety Policy (Testable)**: formalize default mute/ramp/max output policy and per-mode gain staging as a checklist with automated coverage where possible.

### 5.3 HackRF (First-Class Hardware Path)

- [ ] **WebUSB Driver**: HackRF driver conforming to `ISDRDevice`.
- [ ] **Control Transfers**: frequency/gain/sample rate.
- [ ] **Hardware Sweep Mode**: Implement `hackrf_sweep` support for high-speed (>8 GHz/s) spectrum analysis without software retuning.
- [ ] **Bulk Transfers**: efficient IQ streaming.
- [ ] **Retry/Recovery Strategy**: timeouts, stalls, re-enumeration.
- [ ] **USB Stability Heuristics**: hub/power/bandwidth suggestions.
- [ ] **Device Busy/Claimed UX**: clear messaging and recovery when the device is already claimed by another tab/app.
- [ ] **USB Diagnostics Capture (HackRF)**: include endpoint stall events, transfer jitter, and sustained-rate stats in the diagnostics export.
- [ ] **Streaming Profile Presets (HackRF)**: tuned transfer sizing/scheduling presets for common USB controllers/hubs with auto-selection + override.
- [ ] **External Reference Stability Detection (HackRF)**: detect “ref present but unstable” symptoms and guide the user to validate cabling/10 MHz source.
- [ ] **Verification**: real-device testing for sustained streaming.
- [ ] **Reconnect & Resume UX**: graceful tab reload/suspend recovery and safe “resume streaming” flows.
- [ ] **Endpoint Stall Recovery**: detect/clear halted endpoints and resume without full reconnect when possible.
- [ ] **Firmware/Compatibility Awareness**: surface firmware version + guided recovery when incompatibility detected.
- [ ] **Firmware Update & Recovery Flow**: guided update steps, version gating, and recommended recovery paths when the device is in a bad state.
- [ ] **Bootloader/DFU Mode Detection (HackRF)**: detect when the device is in a non-normal USB personality and provide guided recovery steps.
- [ ] **Tuning Accuracy Golden Tests (Real + Sim)**: fixtures and/or beacons that validate requested frequency vs observed tone offset across retunes with tolerances (PPM/AFC state explicit).

### 5.4 Additional Devices / Transports

- [ ] **RTL-SDR Support**: WebUSB where possible; otherwise bridge mode.
- [ ] **RTL-SDR Direct Sampling**: Support Q-branch/I-branch direct sampling for HF reception (0-28 MHz) on standard dongles.
- [ ] **Airspy Support**: WebUSB where possible; otherwise bridge mode.
- [ ] **SDRplay (RSP) Support**: Support via local bridge (due to closed driver) or native if API opens.
- [ ] **PlutoSDR / LimeSDR**: Support via network/USB for RX-only educational/research workflows.
- [ ] **Bridge Transport Security Model**: local-only defaults, explicit pairing, capability discovery, authn/authz story, and safe diagnostics capture.
- [ ] **Bridge Backpressure & Rate Negotiation**: versioned protocol semantics for sustained throughput, jitter control, and clean shutdown/reconnect.

## Phase 6: Core Product Features (Multi-VFO, Recording, Presets)

**Goal:** Turn the receiver into a workflow tool.

### 6.1 VFO Management

- [ ] **Multi-VFO Core (DSP + State)**: multiple demodulators, channel extraction strategy selection, and per-VFO metrics (CPU/time/quality).
- [ ] **Resource Budget UX**: surface VFO CPU/memory/audio-stream warnings with actionable suggestions (pause/solo/disable audio).
- [ ] **VFO UI (Productized)**: per-VFO tuning, mode, bandwidth, squelch, gain, priority, plus focus/solo/mute semantics.
- [ ] **Multi-VFO Overlays**: render multiple VFO markers/regions on spectrum + waterfall (not just a single cursor), with color coding and selection.
- [ ] **Per-VFO Audio Routing**: multi-stream mixer with per-VFO gain and optional pan; configurable max concurrent audio > 1.
- [ ] **VFO Presets**: persist VFO sets as named presets (separate from runtime state) and safely reapply on reconnect.
- [ ] **Multi-VFO Conformance Suite**: continuity/timestamp/discontinuity behavior, strategy-switch correctness, and regression fixtures.

### 6.2 Recording & Persistence

- [ ] **IQ Recording**: record IQ to IndexedDB (SigMF compliant).
- [ ] **Audio Recording**: record demodulated audio.
- [ ] **Instant Replay Ring Buffer**: time-shift listening (“record last N seconds”) with deterministic export that includes tuned state + discontinuity markers.
- [ ] **Quick “Tap Export” (Post-DDC IQ + Post-Demod Audio)**: export short ring-buffer captures (with full metadata) for debugging, sharing, and external-tool interoperability.
- [ ] **Shareable “RF Scene” Bundles**: export an IQ clip + exact pipeline graph/config + analyzer state + device/profile metadata for deterministic support and benchmarking.
- [ ] **Structured Annotations (“RF Notebook”)**: time/frequency-range notes + tags stored with sessions/recordings and included in exports/support bundles.
- [ ] **Repro Manifest + One-Click Replay Entry Point**: each exported bundle includes a single manifest and a deterministic replay entrypoint (no manual “rebuild state” steps).
- [ ] **Trust-Stamped Exports (Measurement Disclosure)**: embed a compact “trust stamp” (session grade, calibration snapshot, drop/underrun stats, RF chain assumptions) into SigMF/WAV metadata and bundle manifests.
- [ ] **Bookmarks**: frequency bookmarking.
- [ ] **Device Presets**: bundle device settings + VFO settings.
- [ ] **SigMF Metadata Editor**: edit/validate metadata and annotations.
- [ ] **Scheduled/Chunked Recording**: quotas, long-running recordings.
- [ ] **Deterministic Replay**: replay recordings through pipeline reproducibly.
- [ ] **IQ Import/Export (Interchange)**: support common interchange formats (e.g., interleaved `int16`/`float32`) plus a metadata sidecar.
- [ ] **Standardized IQ Export Profiles (Scaling Rules)**: define canonical export formats (e.g., `cf32_le`, `cs16_le`, `cu8`) with explicit amplitude scaling/signedness/IQ order guarantees.
- [ ] **Interop-Required Metadata Checklist (Hard Gate)**: validate exports include rate, center/display/LO frequencies, applied PPM, offsets (LO/IF), gain stages, RF chain snapshot, and discontinuity timeline.
- [ ] **Offline Render (Deterministic Demod)**: render demodulated audio from IQ recordings non-realtime for perfect reproducibility and “export even on slow machines”.
- [ ] **Audio Export (Interchange)**: export demodulated output as WAV (and optionally FLAC) with embedded metadata about mode/bandwidth/demod params.
- [ ] **Workspace State Import/Export**: save/load VFOs, markers, band plan selection, calibration profiles, and UI state for portability.
- [ ] **Replay Reproducibility Metadata**: store the DSP chain parameters + app/version info with each recording so replay is actually reproducible.
- [ ] **Frequency/Calibration Provenance in SigMF**: persist PPM, drift estimate/confidence, AFC/lock state, and calibration offsets into recording metadata so frequency and level claims remain meaningful on replay/export.
- [ ] **Storage/Quota UX & Retention**: show available storage, detect IndexedDB quota failures early, and provide retention/cleanup (auto-expire, “export then delete”, compaction).

### 6.3 Recovery UX

- [ ] **Safe Mode**: reset pipeline/device/selected persisted state.
- [ ] **Safe Mode Startup Shortcut**: allow holding a key or URL param to bypass auto-restore/auto-connect for support and recovery.

### 6.4 Frequency Database & Memories (Workflow)

- [ ] **Channel/Memories System**: memory banks with labels/tags/notes, per-entry mode/bandwidth/step, and “apply on tune”.
- [ ] **Scan Lists**: prioritized scan lists with dwell, lockout, and per-list squelch semantics (scanner-grade workflows).
- [ ] **Import/Export**: CSV import/export for memories and scan lists, plus curated regional bandplan packs.
- [ ] **Constraint-Checked “Known Good” Presets**: band/mode/device presets that validate rate/decimation/filter constraints and restore safely on reconnect.

### 6.5 Scanning & Occupancy (Workflow)

- [ ] **Wideband Scan Mode**: fast sweep/step scanning (tune-settle-measure), persistence/hold, occupancy logging, and export for monitoring workflows.

### 6.6 Satellite & Doppler Workflows

- [ ] **TLE Import & Propagation**: Import Two-Line Element sets and propagate orbits (SGP4).
- [ ] **Doppler Correction**: Real-time VFO frequency tracking based on relative velocity.
- [ ] **Rotator Control**: Integration with `rotctld` (via local bridge) for antenna pointing.
- [ ] **Predictive Pass List**: Calculate and display upcoming satellite passes.

## Phase 7: Performance Scaling & Advanced DSP

**Goal:** Scale to wide bandwidths and many VFOs once correctness and UX are established.

- [ ] **Channelization Scaling**: higher-quality filters/taps, lower CPU channel extraction at wide rates, and sustained 20 MHz-class operation.
- [ ] **AGC**: IF/BB AGC for demod stability and audio AGC.
- [ ] **Notch & Spur Mitigation**: DC notch + optional carrier notch.
- [ ] **User-Facing Interference Presets**: safe, explainable presets (DC spike reduction, heterodyne kill, hum notch) with measurable before/after indicators.
- [ ] **Impulse Noise Blanker (HF)**: adjustable blanker to suppress impulsive noise (ignition/sparks) without destroying audio.
- [ ] **Spectral Noise Reduction (NR)**: Spectral subtraction algorithms to reduce steady-state background noise (hiss/static) for voice clarity.
- [ ] **Auto-Notch / Heterodyne Suppression**: track-and-notch single-tone interference with manual override.
- [ ] **Spur Management**: persistent spur annotation/blacklist.
- [ ] **Audio Post-Processing**: noise reduction/blanker/EQ.
- [ ] **Calibration**: PPM correction + manual IQ calibration.
- [ ] **Spur/DC Strategy (Operational)**: user-facing controls for DC notch/blanking and persistent spur annotations.

### 7.1 WebGPU Acceleration (Optional, Late)

- [ ] **Compute Shaders**: FFT/FIR on WebGPU.
- [ ] **Performance**: offload heavy tasks for 20MHz+ pipelines.

### 7.2 Advanced Visualization Engine

- [ ] **3D Waterfall**: Time-frequency-amplitude visualization with WebGPU.
- [ ] **Persistence / Phosphor Display**: decaying heat map for transient detection.
- [ ] **Eye Diagrams**: Inter-symbol interference analysis for digital modes.
- [ ] **Constellation Persistence**: Heatmap style constellation for noisy signal analysis.

## Phase 8: Advanced Digital Modes (Isolated, Incremental)

**Goal:** Add complex standards after the base receiver is robust.

- [ ] **Trunking Controller**: Multi-VFO steering for P25/DMR control channels → voice channels.
- [ ] **ATSC 1.0 (8-VSB)**: demod + transport + playback.
- [ ] **ATSC 3.0 (OFDM)**: demod + PLP selection.
- [ ] **P25**: demod + framing + logging.
- [ ] **DMR / DAB+**: decode pipeline.
- [ ] **TETRA**: demod + framing (European public safety).
- [ ] **IoT Protocols**: LoRa (chirp analysis), Zigbee/Z-Wave (packet capture).
- [ ] **RDS/RBDS**: broadcast data decode + UI.
- [ ] **ADS-B / ACARS / AIS**: decode + mapping.
- [ ] **Reverse Engineering Tools**: bit inspector, pulse analysis, hex/binary view.

## Phase 9: Ecosystem, Measurement & Pro Workflows

**Goal:** Make rad.io extensible and credible for measurement/analysis use cases.

### 9.1 Plugin Architecture

- [ ] **Plugin API**: stable API for demodulators/visualizers.
- [ ] **Loader**: dynamic plugin loading.

### 9.2 Network Sources & Bridge Mode

- [ ] **rtl_tcp**: remote RTL-SDR sources.
- [ ] **SpyServer**: Airspy server protocol.
- [ ] **IQ Streaming Server Mode**: allow the browser to act as a server, streaming IQ to other clients (headless operation).
- [ ] **Universal Hardware Bridge**: versioned control + IQ + timestamp protocol.
- [ ] **First-Class “No WebUSB” Mode**: secure defaults, latency/buffering controls, capabilities discovery.
- [ ] **Minimal Local Bridge (Early Interop)**: opt-in local-only bridge for piping IQ/audio to external tools (UDP/WebSocket), with explicit pairing and diagnostics capture.

### 9.3 Measurement & Analysis

- [ ] **Meters**: SNR, SINAD, THD, carrier power.
- [ ] **Digital Metrics**: Error Vector Magnitude (EVM) and Bit Error Rate (BER) for digital mode analysis.
- [ ] **Detector Modes**: sample/peak/RMS/average.
- [ ] **RBW / ENBW Semantics**: explicit scaling and windowing.
- [ ] **Peak/OBW/ACPR**: automated measurement helpers.
- [ ] **Channel Power + Masks**: channel power measurements and basic spectral mask overlays (where meaningful).
- [ ] **Marker Suite (Pro)**: multiple markers, delta markers, and marker tables (freq, level, bandwidth).
- [ ] **Noise Floor Estimation**: robust estimation + confidence.
- [ ] **Long-Term Monitoring**: heatmaps + occupancy logging.
- [ ] **Units & Calibration Model**: dBFS→(approx) dBm mapping where possible, with per-device calibration storage and disclaimers.
- [ ] **Calibration Workflow**: wizard for calibrating measurements using a known reference source (with per-device/per-band storage and import/export).
- [ ] **Quasi-Absolute Measurement Mode (Disclosure-First)**: a mode where readouts explicitly incorporate calibration + RF chain model + uncertainty bounds (and degrade gracefully to dBFS when prerequisites aren’t met).
- [ ] **System Gain / Noise Figure Estimation (Optional, Guardrailed)**: tooling to estimate system gain and noise floor (with prominent assumptions) to support “credibility” workflows without over-claiming precision.
- [ ] **Measurement Snapshots (Reproducibility)**: save/export a “measurement state” (calibration snapshot + pipeline config + window/ENBW + device profile) so numbers can be reproduced and compared over time.
- [ ] **Trace / Waterfall Data Export**: export spectrum traces and waterfall tiles (with scaling metadata) for reports and offline analysis.
- [ ] **Occupancy & Event Log Export**: export scan/occupancy timelines, discontinuity events, and measurement provenance for post-mortems.
- [ ] **Signal Fingerprinting (SEI)**: Emitter identification via turn-on transients and IQ imbalance signatures.

### 9.4 Professional Interop

- [ ] **WebSerial CAT Control**: Bidirectional frequency/mode sync with hardware rigs (Icom/Yaesu/Kenwood) for panadapter workflows.
- [ ] **VITA 49 Support**: VRT streaming.
- [ ] **IQ Replay Control**: variable rate + single-step.
- [ ] **VCD Export**: logic analysis export.
- [ ] **Session Manager**: save/load full workspace state.
- [ ] **Report Generation**: one-click PDF.
- [ ] **Scripting Console**: in-app JS/WASM console.

### 9.5 Time & Frequency Reference (Pro)

- [ ] **Reference Support**: device clock-source selection (internal vs external 10 MHz) where supported.
- [ ] **Drift Tracking**: estimate/surface LO/clock drift vs “signal moved” and feed into tuning UX.
- [ ] **Coherent Multi-Device Operation**: Phase-coherent operation for direction finding and passive radar (requires shared clock).
- [ ] **Multi-Device Time Alignment (Experimental)**: coarse timestamp alignment across multiple sources for diversity/compare workflows and future coherent features.
- [ ] **Collaborative TDOA**: Multi-node geolocation and triangulation of signal sources.

### 9.6 Automation & Remote Control

- [ ] **Local Control API (Optional)**: local-only API for tune/start/stop/record/markers to enable integrations (with explicit opt-in and security model).
- [ ] **Deep Links / URL Parameters**: open the app pre-tuned to a frequency/mode/bandwidth with safe defaults and validation.
- [ ] **Scheduled Workflows**: scheduled recordings/monitoring jobs with quotas, retention, and diagnostics exports for unattended use.

### 9.7 Hardware Control Surfaces

- [ ] **WebMIDI Support**: Map MIDI knobs, faders, and pads to VFO, gain, and filter controls.
- [ ] **Game Controller Support**: Use Gamepad API for handheld tuning and operation.
- [ ] **Jog Wheel Support**: Support for specific USB HID jog wheels (if accessible via WebHID).

### 9.8 Audio Routing & Interop

- [ ] **Virtual Audio Sink**: Stream demodulated audio via UDP/TCP to local ports for external decoders (WSJT-X, FLDIGI).
- [ ] **External Decoder Workflow Pack (First-Class)**: guided profiles for common decoder integrations (routing, levels, sample rates, PTT disabled, latency notes) and a diagnostic “is my audio clean?” meter view.
- [ ] **Browser-to-Browser Link**: Pipe audio/IQ to other web-based decoders via MessageChannel or RTC.
- [ ] **VAC / VB-Cable Guide**: Documentation and helper tools for routing browser audio to system inputs.

### 9.9 Signal Intelligence (AI/ML)

- [ ] **Automatic Modulation Classification**: TensorFlow.js model to classify signal types (AM/FM/SSB/OFDM) in real-time.
- [ ] **Cyclostationary Feature Detection**: Detect signals below the noise floor.
- [ ] **Anomaly Detection**: Alert on new or unusual signals in a monitored band.

### 9.10 Advanced Accessibility

- [ ] **Waterfall Sonification**: “Pixel-to-Sound” conversion (vOICe-style) to hear the spectrum layout.
- [ ] **Screen Reader Optimization**: ARIA live regions for metering and status updates without spamming.
- [ ] **High Contrast / Tactile Themes**: Themes optimized for low vision and tactile displays.

## Out of Scope

- **Transmit Capabilities**: due to regulatory considerations and safety, no transmission features (Signal Generator, TX mode).
