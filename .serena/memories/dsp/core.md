# DSP And WASM Core

- `crates/dsp-core` is pure/browser-independent DSP: validated configuration, deterministic tone and FM+RDS generation, Hann-window FFT analysis, spectral detection, and stateful RDS block/group decoding.
- `crates/dsp-wasm` is a thin boundary exposing `DspEngine`, `RdsDecoderBank`, typed-array frame getters, and structured metadata snapshots. Keep policy/tracking/UI logic out of this crate.
- FFT contract: symmetric Hann window; magnitude normalized by coefficient sum; bin-centered complex amplitude `A` reports `20 log10(A)` dBFS; shifted bins span `[-sampleRate/2, +sampleRate/2)`; floor is -120 dBFS.
- Detector estimates frame-local noise from the lower finite-bin percentile with a DC guard, groups occupied bins with a small gap tolerance, suppresses isolated center spikes/window leakage, and returns at most 16 strongest regions.
- Analyzer plans and Hann coefficients are rebuilt only when configuration changes, never per frame.
- Generated mode advances continuous source time even though only the newest FFT window is displayed; this preserves RDS symbol continuity under display backpressure.
- Native Rust tests are the fast proof for algorithms. Cross-language changes also require release WASM/frontend build and affected browser tests.
- Read `mem:rds/core` for decoder continuity/metadata contracts and `mem:frontend/core` for frame protocol and ownership at the JS boundary.