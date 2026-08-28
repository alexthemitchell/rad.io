# Project Core

- Browser-native, receive-only signal analyzer. Deterministic generated IQ and live HackRF WebUSB IQ converge on the same Rust/WASM analysis pipeline.
- Source map: `src/` owns React UI, controller/frame flow, workers, TypeScript tracking/classification, renderers, RDS integration, and hardware sources; `crates/dsp-core/` is browser-independent DSP; `crates/dsp-wasm/` is the thin `wasm-bindgen` boundary; `e2e/` contains real worker/WASM browser workflows; `docs/` is the canonical contract documentation.
- Hot-path invariant: IQ packets, FFT arrays, and rendered frames stay out of React state. Workers own continuous acquisition/DSP, transferable buffers carry numeric arrays, and React samples compact status at low rate.
- Read `mem:frontend/core` for main-thread, worker protocol, rendering, tracking, and buffer-ownership boundaries.
- Read `mem:dsp/core` for Rust crate ownership, FFT/detection contracts, and WASM boundary rules.
- Read `mem:hardware/core` for HackRF/WebUSB lifecycle, acquisition backpressure, and live-hardware constraints.
- Read `mem:rds/core` for target selection, decoder continuity, metadata freshness, and hardware verification.
- Read `mem:tech_stack` when changing dependencies, toolchains, generated WASM, or browser requirements.
- Read `mem:conventions` before implementation work; use `mem:suggested_commands` for focused commands and `mem:task_completion` before declaring a change done.
- Use the repository `sdr-hardware-verification` skill whenever correctness involves live RF, DSP, detection/tracking, spectrum rendering, demodulation, HackRF acquisition, or RDS output.