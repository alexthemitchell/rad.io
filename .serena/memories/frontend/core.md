# Frontend And Worker Core

- `App.tsx` owns controls and low-rate UI state; `AnalyzerController` owns one `DspWorkerClient` for its lifetime. Avoid effect dependencies that recreate worker/source lifetimes during live streaming.
- `FrameHub` publishes the latest transferable analysis frame on `requestAnimationFrame`; spectrum, waterfall, and waveform renderers consume arrays directly without React renders.
- Every renderer follows `resize(width, height, pixelRatio)`, `draw(frame)`, and `reset()`. Canvas dimensions are stabilized by `ResizeObserver` and capped DPR.
- `src/workers/protocol.ts` is the DSP-worker contract. Protocol version agreement with WASM is mandatory; generated flow permits one frame awaiting `frame-consumed`.
- External `SampleChunk` is format version 1, exact one configured FFT block, interleaved `Float32Array`, and carries sample rate, RF center, sequence, and monotonic source timestamp. Ingestion returns the transferred buffer plus `dropped` so sources can reuse a fixed pool.
- TypeScript detection ownership: frame regions come from Rust; `SignalTracker` associates bounded tracks; band-plan classification adds evidence; broadcast coalescing/gating prevents station duplicates/spurs; `RdsTargetSelector` chooses sticky eligible channel centers.
- Compact status is sampled about every 250 ms. Never route full-rate USB/RDS IQ or frame arrays through component state.
- Read `mem:hardware/core` before changing source/acquisition ownership, `mem:rds/core` before changing metadata flow, and `mem:dsp/core` before changing WASM frame semantics.