# Conventions

- Keep `dsp-core` browser-independent. Browser-facing conversion, typed-array getters, and snapshot serialization belong in thin `dsp-wasm` exports.
- Keep continuous acquisition and DSP in workers. Do not put per-packet/per-frame numeric data in React state; preserve transfer-and-return ownership for reusable buffers.
- Treat worker protocol versions, WASM protocol versions, message unions, and transfer ownership as one contract; update all sides and browser tests together.
- TypeScript is ESM, strict, and rejects unused locals/parameters and switch fallthrough. React hooks and Vite refresh lint rules apply.
- Tests are colocated as `*.test.ts` / `*.test.tsx`; end-to-end specs live in `e2e/`. Prefer deterministic generated IQ for regressions, then independent live-hardware proof where RF behavior is in scope.
- Preserve units in names (`Hz`, `dBFS`, source timestamps in microseconds) and preserve the interleaved IQ contract `[I0, Q0, I1, Q1, ...]`.
- Measured spectral fields, allocation-based service evidence, and decoded metadata are separate evidence layers. Do not present the deterministic evidence score as probability or allocation matches as decoded identity.
- Levels are relative dBFS, never calibrated dBm. `centerFrequencyHz = 0` means baseband-only classification.
- State and histories must stay bounded: signal tracks, pending display blocks, RDS targets, metadata histories, and in-flight frames all have explicit caps.
- Prefer the existing ownership abstractions (`AnalyzerController`, source interface, worker protocols, `FrameHub`, renderer contract) over bypassing them.