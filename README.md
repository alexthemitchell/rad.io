# rad.io

A browser-based signal analyzer with DSP implemented in Rust, compiled to WebAssembly, and isolated in dedicated web workers.

The analyzer accepts a deterministic complex IQ generator or live RF from a HackRF One connected directly through WebUSB. Both sources drive the same spectrum, scrolling waterfall, dual I/Q waveform, and automatic signal inventory. HackRF support runs entirely in the browser without `libhackrf`, a native helper, a browser extension, or an application-supplied driver package.

The detector estimates the noise floor, extracts multiple occupied spectral regions, tracks them across frames, and attaches evidence-based service candidates from a selectable FCC/United States allocation profile. Confirmed FM broadcast stations are additionally eligible for RDS/RBDS decoding, which adds transmitted station identity and program metadata when the subcarrier can be synchronized.

## Prerequisites

- Node.js 22 or newer
- Rust stable through [rustup](https://rustup.rs/)
- The `wasm32-unknown-unknown` Rust target
- `wasm-pack`
- Desktop Chromium or Microsoft Edge; WebUSB hardware access requires a secure context

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
- 15 dB minimum detection SNR for generated IQ

The generator also includes a fixed **FM + RDS** preset at 100.1 MHz. It emits a deterministic stereo multiplex and RBDS group cycle for exercising station identification without radio hardware.

The HackRF One source starts with conservative receive-only settings:

- 100 MHz center frequency
- 2 MS/s complex sample rate
- 1.75 MHz baseband filter
- 2,048-point FFT at up to 30 analysis frames per second
- 16 dB LNA gain and 20 dB VGA gain
- RF amplifier and antenna bias power off
- 25 dB minimum detection SNR, with independent adjustment from generated IQ

## HackRF One

Select **HackRF**, then **Connect**. On first use, choose the radio in Chromium's USB picker; later connections reuse the origin's retained device permission without reopening the picker while that authorized HackRF is available. The browser opens the vendor interface, configures receive mode, and streams signed 8-bit interleaved IQ into the existing Rust/WASM analyzer. Stop returns the radio to transceiver-off mode and closes the browser USB session without revoking permission.

The implementation is platform-neutral and contains no OS detection or native fallback. Windows can bind HackRF firmware's `USB\MS_COMP_WINUSB` identity to the inbox WinUSB service; macOS exposes the device through its USB stack. Some Linux host policies deny browser access to raw USB device nodes. A sandboxed page cannot alter that policy, so rad.io reports the host denial rather than installing or invoking system software.

WebUSB is not implemented by Firefox or Safari. Production hosting must use HTTPS; loopback development URLs are treated as secure contexts by Chromium.

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

The main thread owns permission selection, controls, low-rate status, and Canvas2D rendering. A browser acquisition worker owns HackRF USB transfers and continuous live RDS decoding, while the DSP worker owns signal generation, generated RDS decoding, FFT state, signal tracking/classification, and frame pacing. Numeric arrays move through transferable `ArrayBuffer` objects and are published to renderers on `requestAnimationFrame`; live packets are never stored in React state.

See [docs/architecture.md](docs/architecture.md) for protocol, ownership, scaling, and WebUSB integration details.
See [docs/signal-detection.md](docs/signal-detection.md) for detection behavior, metadata semantics, profile provenance, and limitations.
See [docs/rds.md](docs/rds.md) for RDS/RBDS decoding, supported groups, target selection, and data-quality semantics.

## Scope

HackRF support is receive-only. This milestone intentionally excludes transmit, hardware sweep mode, antenna bias enablement, firmware flashing/reset, calibrated dBm measurements, audio playback, recording, SharedArrayBuffer, and WebGL. RDS application groups are retained, but external TMC location/event databases and application-specific ODA semantic plugins are not bundled.
