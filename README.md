# rad.io

A browser-based baseband signal analyzer with DSP implemented in Rust, compiled to WebAssembly, and isolated in a dedicated web worker.

The current signal source is a deterministic complex IQ tone with optional Gaussian noise. It drives a live spectrum, scrolling waterfall, dual I/Q waveform, and an automatic signal inventory. The worker also accepts externally supplied interleaved IQ buffers through the same analysis path for future WebUSB SDR input.

The detector estimates the noise floor, extracts multiple occupied spectral regions, tracks them across frames, and attaches evidence-based service candidates from a selectable FCC/United States allocation profile. These labels are frequency-allocation matches, not decoded station identities or verified modulation types.

## Prerequisites

- Node.js 22 or newer
- Rust stable through [rustup](https://rustup.rs/)
- The `wasm32-unknown-unknown` Rust target
- `wasm-pack`
- Chromium or Microsoft Edge for the current browser target

On Windows PowerShell:

```powershell
rustup target add wasm32-unknown-unknown
cargo install wasm-pack --locked
npm install
npx playwright install chromium
```

## Development

```powershell
npm run dev
```

The `predev` script builds the development WASM package before Vite starts. Open `http://127.0.0.1:5173/` when using the explicit host flag, or the URL printed by Vite otherwise.

The initial analyzer defaults are:

- 1 MS/s complex sample rate
- 0 Hz RF center (baseband-only classification)
- 2,048-point Hann-window FFT
- +100 kHz tone offset
- -12 dBFS tone level
- -72 dBFS deterministic Gaussian noise
- 30 analysis frames per second
- 15 dB minimum detection SNR

## Commands

| Command | Purpose |
| --- | --- |
| `npm run wasm:dev` | Build unoptimized browser WASM bindings |
| `npm run wasm:release` | Build release browser WASM bindings |
| `npm run type-check` | Run strict TypeScript checking |
| `npm run lint` | Lint authored TypeScript and React code |
| `npm test` | Run Vitest unit tests |
| `npm run test:e2e` | Run Playwright against the real worker/WASM bundle |
| `npm run rust:test` | Run native Rust workspace tests |
| `npm run build` | Build release WASM and the production frontend |
| `npm run validate` | Run Rust, lint, unit, build, and browser checks |

For strict Rust linting:

```powershell
cargo fmt --check
cargo clippy --workspace --all-targets -- -D warnings
```

## Architecture

The main thread owns controls, low-rate status, and Canvas2D rendering. The dedicated worker owns signal generation, FFT state, signal tracking/classification, and frame pacing. Numeric arrays move through transferable `ArrayBuffer` objects and are published to renderers on `requestAnimationFrame`; live packets are never stored in React state.

See [docs/architecture.md](docs/architecture.md) for protocol, ownership, scaling, and WebUSB integration details.
See [docs/signal-detection.md](docs/signal-detection.md) for detection behavior, metadata semantics, profile provenance, and limitations.

## Scope

This milestone intentionally excludes device permission UI, hardware-specific SDR drivers, wideband scan scheduling, demodulation/audio, station-directory lookup, payload decoding, recording, SharedArrayBuffer, and WebGL. Those can be added behind the existing source, worker, detector, and renderer contracts after measured need.
