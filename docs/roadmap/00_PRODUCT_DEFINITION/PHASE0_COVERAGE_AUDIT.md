<!-- markdownlint-disable MD060 -->

# Phase 0 Coverage Audit

Generated: 2025-12-12 20:19:36

## Summary

- Roadmap Phase 0 checkbox items: 58
- Task files under docs/roadmap/00_PRODUCT_DEFINITION: 58
- Missing tasks: 0
- Duplicate matches: 0
- Unmapped task files: 58
- Metadata/title mismatches: 0
- Naming convention warnings: 12

## Phase 0 Roadmap Items (Normalized)

| Section | Ord | Title | Description |
|---|---:|---|---|
| 0.A | 1 | Define MVP User Journeys | connect source â†’ see spectrum/waterfall â†’ tune â†’ listen â†’ record â†’ replay. |
| 0.A | 2 | Define Performance Budgets | target 60 FPS visuals, predictable latency, CPU headroom for multi-VFO. |
| 0.A | 3 | Define Reliability Budgets | tolerated drop rate, overrun behavior, recovery expectations. |
| 0.A | 4 | Define Test Strategy | what is covered by unit tests vs simulated E2E vs real-device E2E. |
| 0.A | 5 | Define Support Matrix | browsers/OS targets (e.g., Chrome/Edge on Windows first) + WebUSB/WebAudio constraints. |
| 0.A | 6 | Define Performance Regression Gates | repeatable benchmarks for FPS, end-to-end latency, dropped-sample rate, and USB throughput/jitter. |
| 0.A | 7 | Define Time/Frequency Accuracy Budgets | target PPM/drift bounds, â€œRF-accurate vs audio-stableâ€ modes, and what is guaranteed for recordings/replay. |
| 0.A | 8 | Architecture Validation Spike | prove the `WebUSB â†’ Worker â†’ WebAudio` critical path meets latency budgets on target hardware. |
| 0.A | 9 | CI/CD Pipeline & Quality Gates | automate linting, testing, and performance regression checks on every commit. |
| 0.A | 10 | Data Privacy & Security Policy | define handling of local recordings, settings, and device permissions. |
| 0.A | 11 | Operator Safety & Compliance Defaults | define safe audio defaults, recording/monitoring UX guardrails, and provenance metadata expectations. |
| 0.A | 12 | Documentation Strategy | establish processes for keeping architecture and requirements documentation in sync with code. |
| 0.0 | 1 | Define Primary Personas + Jobs To Be Done | â€œlistenerâ€, â€œRF explorerâ€, â€œdiagnostics/supportâ€, â€œmeasurement-liteâ€. |
| 0.0 | 2 | Competitive/Reference App Review | identify 5â€“10 reference receivers/analyzers and extract UX patterns worth copying/avoiding. |
| 0.0 | 3 | Problem Statement + Success Metrics | a crisp one-page statement + measurable success metrics (activation, retention proxy, crash-free sessions). |
| 0.0 | 4 | MVP Demo Script (10 minutes) | a repeatable, end-to-end demo that becomes the definition of â€œworkingâ€. |
| 0.0 | 5 | Definition of Ready (Roadmap Items) | minimum info required before implementing an item (acceptance, UX, telemetry, risks). |
| 0.1 | 1 | Define MVP Scope + Explicit Non-Goals | lock MVP feature set, polish level, and what is deliberately excluded. |
| 0.1 | 2 | Define â€œMVP Exit Checklistâ€ | a short acceptance checklist tied to user journeys + budgets (perf/reliability). |
| 0.2 | 1 | Information Architecture (IA) Map | panels/navigation, what is always visible, and how users discover key actions. |
| 0.2 | 2 | Connection UX Contract | explicit UX for device pairing/claiming, streaming start/stop, and audio enablement (including recovery states and copy). |
| 0.2 | 3 | Empty/Error State Catalog (MVP) | define UI behavior for â€œno deviceâ€, â€œno signalâ€, â€œaudio blockedâ€, â€œpermission revokedâ€, â€œdevice busyâ€, â€œdropped samplesâ€. |
| 0.2 | 4 | Tuning Interaction Contract | click/drag-to-tune semantics, wheel/keyboard stepping rules, direct frequency entry, and focus behavior. |
| 0.2 | 5 | Receiver Mental Model Decision | define and document semantics for center frequency vs tuned frequency vs span vs VFO. |
| 0.2 | 6 | Frequency Planning / Artifact Awareness Contract | define how the UI explains DC spur, images, and aliasing risk and what one-click mitigations are permitted (LO shift/IF shift, bandwidth clamp, rate change). |
| 0.3 | 1 | Design Tokens Spec | CSS variables for spacing, typography scale, elevation, focus rings, and semantic colors. |
| 0.3 | 2 | Core Component Spec Pack | Button/Toggle, Slider, Numeric input (frequency), Dropdown, Tabs, Toast/Alert, Modal, Tooltip. |
| 0.3 | 3 | Accessibility-First Requirements (UX) | keyboard-only flows for MVP, minimum contrast targets, reduced-motion behavior. |
| 0.3 | 4 | Interaction Prototype (Clickable) | validate tuning + layout + safety flows before implementation (e.g., Figma prototype). |
| 0.3 | 5 | Keyboard Shortcut Map (Early) | reserve key bindings for core ops (tune, step, start/stop, mute, record) to avoid rework. |
| 0.4 | 1 | ADR: Worker Topology + Message Schema | single vs multiple workers, schema versioning, and compatibility strategy. |
| 0.4 | 2 | ADR: `SharedArrayBuffer` Strategy | COOP/COEP requirements, fallback behavior, and feature degradations. |
| 0.4 | 3 | ADR: State & Persistence Boundaries | what lives in Zustand vs URL vs localStorage vs IndexedDB (including migrations). |
| 0.4 | 4 | ADR: Error Taxonomy + User-Facing Error UX | typed errors, retryability, and diagnostics bundle linkage. |
| 0.4 | 5 | ADR: UI Architecture + Component Strategy | state boundaries (UI vs DSP), component library approach (custom vs headless), and theming/token strategy. |
| 0.4 | 6 | ADR: Plugin/Extension Boundary (Future-Proofing) | define extension points and constraints even if plugins ship later. |
| 0.4 | 7 | ADR: Source/DSP/Audio Sink Contracts | explicit interfaces + versioning strategy (so Mock/File/WebUSB can share the pipeline). |
| 0.4 | 8 | ADR: Runtime Schema Validation | where/how to validate messages/state (e.g., Zod at boundaries) without perf cliffs. |
| 0.5 | 1 | Canonical Session State Shape | device/tuning/demod/UI/perf settings model with a versioned schema. |
| 0.5 | 2 | Telemetry Contract + Retention Window | define counters/events required for budgets (drops, underruns, latency, USB stalls). |
| 0.5 | 3 | Diagnostics Bundle Format (Versioned) | structure, redaction/anonymization rules, and replay/debug expectations. |
| 0.5 | 4 | Frequency Planning / LO Model Contract (Unified) | define RF frequency vs tuner LO vs display frequency, plus LO/IF offsets and how they propagate into readouts, exports, and retune math. |
| 0.5 | 5 | Calibration & Disclosure Contract (Measurement Claims) | define what â€œuncalibrated/approx/calibratedâ€ means for frequency and level, what evidence is required for â€œmeasurement-grade,â€ and how assumptions/uncertainty must be surfaced in UI and exports. |
| 0.5 | 6 | RF Chain Model Contract (Structured) | define the canonical schema for antenna/RF-chain/transverter context (LNA/attenuator/filter/bias-tee/IF offsets), where it is stored, and how it affects frequency/level mappings and diagnostics. |
| 0.6 | 1 | Top Risks Register | top ~10 risks with owner, mitigation plan, and acceptance validation. |
| 0.6 | 2 | Spike Plan (2â€“3 Timeboxed Spikes) | retire biggest unknowns (WebUSB stability/throughput, workerâ†’audio latency, 60 FPS rendering). |
| 0.6 | 3 | Definition of â€œDegraded Modeâ€ | agree on safe behavior when budgets are missed (mute ramps, lower FFT rate, reduced resolution). |
| 0.6 | 4 | Secure Context + HTTPS Dev Plan (Windows) | local cert strategy, localhost exceptions, and â€œhow to runâ€ guidance. |
| 0.6 | 5 | Cross-Origin Isolation Deployment Plan | ensure COOP/COEP headers in dev/prod and define the fallback feature set. |
| 0.7 | 1 | Definition of Done (PR/Issue) | required checks, test updates, perf impact notes, ADR-needed rule. |
| 0.7 | 2 | Roadmap â†’ Issues Policy | every roadmap checkbox becomes an issue with acceptance criteria; epics get sub-issues. |
| 0.7 | 3 | Labeling/Ownership Conventions | area labels (usb/dsp/audio/ui), risk tags, and owner expectations. |
| 0.7 | 4 | MVP Cutline + Sequencing Rules | label items as Must/Should/Could and define â€œvertical slice firstâ€ sequencing for new subsystems. |
| 0.8 | 1 | Preview Distribution Plan | how pre-release builds are shared and how feedback is collected and triaged. |
| 0.8 | 2 | Versioning Policy for Fixtures/Recordings | compatibility expectations for early users and regression assets. |
| 0.9 | 1 | Issue Templates + Acceptance Criteria Template | standardize bug/feature/driver issues so work stays testable and user-visible. |
| 0.9 | 2 | Release Checklist (MVP) | versioning, changelog notes, migration notes, browser matrix, and â€œdemo script passesâ€ gate. |
| 0.9 | 3 | Telemetry/Privacy Review Gate | ensure diagnostics/telemetry items always include redaction rules and explicit user consent UX. |

## Task Files (Extracted Fields)

| Task File | H1 | ID | Roadmap | Roadmap Description |
|---|---|---|---|---|
| docs\roadmap\00_PRODUCT_DEFINITION\00_0A_SUCCESS_GATES_MUST_NOT_CHURN\P0-0A-12_documentation-strategy.md |  |  |  |  |

## Mapping (Roadmap Item → Task File)

| Roadmap | Task |
|---|---|

## Unmapped Task Files

- docs\roadmap\00_PRODUCT_DEFINITION\00_00_PRODUCT_DISCOVERY\P0-00-01_define-primary-personas-jtbd.md
- docs\roadmap\00_PRODUCT_DEFINITION\00_00_PRODUCT_DISCOVERY\P0-00-02_competitive-reference-app-review.md
- docs\roadmap\00_PRODUCT_DEFINITION\00_00_PRODUCT_DISCOVERY\P0-00-03_problem-statement-success-metrics.md
- docs\roadmap\00_PRODUCT_DEFINITION\00_00_PRODUCT_DISCOVERY\P0-00-04_mvp-demo-script-10-minutes.md
- docs\roadmap\00_PRODUCT_DEFINITION\00_00_PRODUCT_DISCOVERY\P0-00-05_definition-of-ready-roadmap-items.md
- docs\roadmap\00_PRODUCT_DEFINITION\00_01_SCOPE_SUCCESS_DEFINITION\P0-01-01_define-mvp-scope-non-goals.md
- docs\roadmap\00_PRODUCT_DEFINITION\00_01_SCOPE_SUCCESS_DEFINITION\P0-01-02_mvp-exit-checklist.md
- docs\roadmap\00_PRODUCT_DEFINITION\00_02_UX_FOUNDATIONS\P0-02-01_information-architecture-ia-map.md
- docs\roadmap\00_PRODUCT_DEFINITION\00_02_UX_FOUNDATIONS\P0-02-02_connection-ux-contract.md
- docs\roadmap\00_PRODUCT_DEFINITION\00_02_UX_FOUNDATIONS\P0-02-03_empty-error-state-catalog-mvp.md
- docs\roadmap\00_PRODUCT_DEFINITION\00_02_UX_FOUNDATIONS\P0-02-04_tuning-interaction-contract.md
- docs\roadmap\00_PRODUCT_DEFINITION\00_02_UX_FOUNDATIONS\P0-02-05_receiver-mental-model-decision.md
- docs\roadmap\00_PRODUCT_DEFINITION\00_02_UX_FOUNDATIONS\P0-02-06_frequency-planning-artifact-awareness-contract.md
- docs\roadmap\00_PRODUCT_DEFINITION\00_03_DESIGN_SYSTEM_FOUNDATIONS\P0-03-01_design-tokens-spec.md
- docs\roadmap\00_PRODUCT_DEFINITION\00_03_DESIGN_SYSTEM_FOUNDATIONS\P0-03-02_core-component-spec-pack.md
- docs\roadmap\00_PRODUCT_DEFINITION\00_03_DESIGN_SYSTEM_FOUNDATIONS\P0-03-03_accessibility-first-requirements-ux.md
- docs\roadmap\00_PRODUCT_DEFINITION\00_03_DESIGN_SYSTEM_FOUNDATIONS\P0-03-04_interaction-prototype-clickable.md
- docs\roadmap\00_PRODUCT_DEFINITION\00_03_DESIGN_SYSTEM_FOUNDATIONS\P0-03-05_keyboard-shortcut-map-early.md
- docs\roadmap\00_PRODUCT_DEFINITION\00_04_ARCHITECTURE_IRREVERSIBLE_DECISIONS_ADRS\P0-04-01_adr-worker-topology-message-schema.md
- docs\roadmap\00_PRODUCT_DEFINITION\00_04_ARCHITECTURE_IRREVERSIBLE_DECISIONS_ADRS\P0-04-02_adr-sharedarraybuffer-strategy.md
- docs\roadmap\00_PRODUCT_DEFINITION\00_04_ARCHITECTURE_IRREVERSIBLE_DECISIONS_ADRS\P0-04-03_adr-state-persistence-boundaries.md
- docs\roadmap\00_PRODUCT_DEFINITION\00_04_ARCHITECTURE_IRREVERSIBLE_DECISIONS_ADRS\P0-04-04_adr-error-taxonomy-user-facing-error-ux.md
- docs\roadmap\00_PRODUCT_DEFINITION\00_04_ARCHITECTURE_IRREVERSIBLE_DECISIONS_ADRS\P0-04-05_adr-ui-architecture-component-strategy.md
- docs\roadmap\00_PRODUCT_DEFINITION\00_04_ARCHITECTURE_IRREVERSIBLE_DECISIONS_ADRS\P0-04-06_adr-plugin-extension-boundary.md
- docs\roadmap\00_PRODUCT_DEFINITION\00_04_ARCHITECTURE_IRREVERSIBLE_DECISIONS_ADRS\P0-04-07_adr-source-dsp-audio-sink-contracts.md
- docs\roadmap\00_PRODUCT_DEFINITION\00_04_ARCHITECTURE_IRREVERSIBLE_DECISIONS_ADRS\P0-04-08_adr-runtime-schema-validation.md
- docs\roadmap\00_PRODUCT_DEFINITION\00_05_DATA_TELEMETRY_CONTRACTS\P0-05-01_canonical-session-state-shape.md
- docs\roadmap\00_PRODUCT_DEFINITION\00_05_DATA_TELEMETRY_CONTRACTS\P0-05-02_telemetry-contract-retention-window.md
- docs\roadmap\00_PRODUCT_DEFINITION\00_05_DATA_TELEMETRY_CONTRACTS\P0-05-03_diagnostics-bundle-format-versioned.md
- docs\roadmap\00_PRODUCT_DEFINITION\00_05_DATA_TELEMETRY_CONTRACTS\P0-05-04_frequency-planning-lo-model-contract-unified.md
- docs\roadmap\00_PRODUCT_DEFINITION\00_05_DATA_TELEMETRY_CONTRACTS\P0-05-05_calibration-disclosure-contract-measurement-claims.md
- docs\roadmap\00_PRODUCT_DEFINITION\00_05_DATA_TELEMETRY_CONTRACTS\P0-05-06_rf-chain-model-contract-structured.md
- docs\roadmap\00_PRODUCT_DEFINITION\00_06_RISK_REGISTER_VALIDATION_SPIKES\P0-06-01_top-risks-register.md
- docs\roadmap\00_PRODUCT_DEFINITION\00_06_RISK_REGISTER_VALIDATION_SPIKES\P0-06-02_spike-plan-2-3-timeboxed-spikes.md
- docs\roadmap\00_PRODUCT_DEFINITION\00_06_RISK_REGISTER_VALIDATION_SPIKES\P0-06-03_definition-of-degraded-mode.md
- docs\roadmap\00_PRODUCT_DEFINITION\00_06_RISK_REGISTER_VALIDATION_SPIKES\P0-06-04_secure-context-https-dev-plan-windows.md
- docs\roadmap\00_PRODUCT_DEFINITION\00_06_RISK_REGISTER_VALIDATION_SPIKES\P0-06-05_cross-origin-isolation-deployment-plan.md
- docs\roadmap\00_PRODUCT_DEFINITION\00_07_PROJECT_HYGIENE_EXECUTION_SYSTEM\P0-07-01_definition-of-done-pr-issue.md
- docs\roadmap\00_PRODUCT_DEFINITION\00_07_PROJECT_HYGIENE_EXECUTION_SYSTEM\P0-07-02_roadmap-to-issues-policy.md
- docs\roadmap\00_PRODUCT_DEFINITION\00_07_PROJECT_HYGIENE_EXECUTION_SYSTEM\P0-07-03_labeling-ownership-conventions.md
- docs\roadmap\00_PRODUCT_DEFINITION\00_07_PROJECT_HYGIENE_EXECUTION_SYSTEM\P0-07-04_mvp-cutline-sequencing-rules.md
- docs\roadmap\00_PRODUCT_DEFINITION\00_08_PREVIEW_RELEASE_STRATEGY\P0-08-01_preview-distribution-plan.md
- docs\roadmap\00_PRODUCT_DEFINITION\00_08_PREVIEW_RELEASE_STRATEGY\P0-08-02_versioning-policy-for-fixtures-recordings.md
- docs\roadmap\00_PRODUCT_DEFINITION\00_09_BACKLOG_RELEASE_CHANGE_MANAGEMENT\P0-09-01_issue-templates-acceptance-criteria-template.md
- docs\roadmap\00_PRODUCT_DEFINITION\00_09_BACKLOG_RELEASE_CHANGE_MANAGEMENT\P0-09-02_release-checklist-mvp.md
- docs\roadmap\00_PRODUCT_DEFINITION\00_09_BACKLOG_RELEASE_CHANGE_MANAGEMENT\P0-09-03_telemetry-privacy-review-gate.md
- docs\roadmap\00_PRODUCT_DEFINITION\00_0A_SUCCESS_GATES_MUST_NOT_CHURN\P0-0A-01_define-mvp-user-journeys.md
- docs\roadmap\00_PRODUCT_DEFINITION\00_0A_SUCCESS_GATES_MUST_NOT_CHURN\P0-0A-02_define-performance-budgets.md
- docs\roadmap\00_PRODUCT_DEFINITION\00_0A_SUCCESS_GATES_MUST_NOT_CHURN\P0-0A-03_define-reliability-budgets.md
- docs\roadmap\00_PRODUCT_DEFINITION\00_0A_SUCCESS_GATES_MUST_NOT_CHURN\P0-0A-04_define-test-strategy.md
- docs\roadmap\00_PRODUCT_DEFINITION\00_0A_SUCCESS_GATES_MUST_NOT_CHURN\P0-0A-05_define-support-matrix.md
- docs\roadmap\00_PRODUCT_DEFINITION\00_0A_SUCCESS_GATES_MUST_NOT_CHURN\P0-0A-06_define-performance-regression-gates.md
- docs\roadmap\00_PRODUCT_DEFINITION\00_0A_SUCCESS_GATES_MUST_NOT_CHURN\P0-0A-07_define-time-frequency-accuracy-budgets.md
- docs\roadmap\00_PRODUCT_DEFINITION\00_0A_SUCCESS_GATES_MUST_NOT_CHURN\P0-0A-08_architecture-validation-spike.md
- docs\roadmap\00_PRODUCT_DEFINITION\00_0A_SUCCESS_GATES_MUST_NOT_CHURN\P0-0A-09_ci-cd-pipeline-quality-gates.md
- docs\roadmap\00_PRODUCT_DEFINITION\00_0A_SUCCESS_GATES_MUST_NOT_CHURN\P0-0A-10_data-privacy-security-policy.md
- docs\roadmap\00_PRODUCT_DEFINITION\00_0A_SUCCESS_GATES_MUST_NOT_CHURN\P0-0A-11_operator-safety-compliance-defaults.md
- docs\roadmap\00_PRODUCT_DEFINITION\00_0A_SUCCESS_GATES_MUST_NOT_CHURN\P0-0A-12_documentation-strategy.md

| .  |  |  |  |  |  |  |  |

## Naming Convention Warnings

- docs\roadmap\00_PRODUCT_DEFINITION\00_0A_SUCCESS_GATES_MUST_NOT_CHURN\P0-0A-01_define-mvp-user-journeys.md: ID uses 0A but file is not in 00_0A_SUCCESS_GATES_MUST_NOT_CHURN
- docs\roadmap\00_PRODUCT_DEFINITION\00_0A_SUCCESS_GATES_MUST_NOT_CHURN\P0-0A-02_define-performance-budgets.md: ID uses 0A but file is not in 00_0A_SUCCESS_GATES_MUST_NOT_CHURN
- docs\roadmap\00_PRODUCT_DEFINITION\00_0A_SUCCESS_GATES_MUST_NOT_CHURN\P0-0A-03_define-reliability-budgets.md: ID uses 0A but file is not in 00_0A_SUCCESS_GATES_MUST_NOT_CHURN
- docs\roadmap\00_PRODUCT_DEFINITION\00_0A_SUCCESS_GATES_MUST_NOT_CHURN\P0-0A-04_define-test-strategy.md: ID uses 0A but file is not in 00_0A_SUCCESS_GATES_MUST_NOT_CHURN
- docs\roadmap\00_PRODUCT_DEFINITION\00_0A_SUCCESS_GATES_MUST_NOT_CHURN\P0-0A-05_define-support-matrix.md: ID uses 0A but file is not in 00_0A_SUCCESS_GATES_MUST_NOT_CHURN
- docs\roadmap\00_PRODUCT_DEFINITION\00_0A_SUCCESS_GATES_MUST_NOT_CHURN\P0-0A-06_define-performance-regression-gates.md: ID uses 0A but file is not in 00_0A_SUCCESS_GATES_MUST_NOT_CHURN
- docs\roadmap\00_PRODUCT_DEFINITION\00_0A_SUCCESS_GATES_MUST_NOT_CHURN\P0-0A-07_define-time-frequency-accuracy-budgets.md: ID uses 0A but file is not in 00_0A_SUCCESS_GATES_MUST_NOT_CHURN
- docs\roadmap\00_PRODUCT_DEFINITION\00_0A_SUCCESS_GATES_MUST_NOT_CHURN\P0-0A-08_architecture-validation-spike.md: ID uses 0A but file is not in 00_0A_SUCCESS_GATES_MUST_NOT_CHURN
- docs\roadmap\00_PRODUCT_DEFINITION\00_0A_SUCCESS_GATES_MUST_NOT_CHURN\P0-0A-09_ci-cd-pipeline-quality-gates.md: ID uses 0A but file is not in 00_0A_SUCCESS_GATES_MUST_NOT_CHURN
- docs\roadmap\00_PRODUCT_DEFINITION\00_0A_SUCCESS_GATES_MUST_NOT_CHURN\P0-0A-10_data-privacy-security-policy.md: ID uses 0A but file is not in 00_0A_SUCCESS_GATES_MUST_NOT_CHURN
- docs\roadmap\00_PRODUCT_DEFINITION\00_0A_SUCCESS_GATES_MUST_NOT_CHURN\P0-0A-11_operator-safety-compliance-defaults.md: ID uses 0A but file is not in 00_0A_SUCCESS_GATES_MUST_NOT_CHURN
- docs\roadmap\00_PRODUCT_DEFINITION\00_0A_SUCCESS_GATES_MUST_NOT_CHURN\P0-0A-12_documentation-strategy.md: ID uses 0A but file is not in 00_0A_SUCCESS_GATES_MUST_NOT_CHURN


