# rad.io

A browser-based signal analyzer and multi-VFO receiver with DSP implemented in Rust, compiled to WebAssembly, and isolated in dedicated web workers.

The analyzer accepts a deterministic complex IQ generator or live RF from a HackRF One connected directly through WebUSB. Both sources drive the same spectrum, scrolling waterfall, dual I/Q waveform, and automatic signal inventory. HackRF support runs entirely in the browser without `libhackrf`, a native helper, a browser extension, or an application-supplied driver package.

The detector estimates the noise floor, extracts multiple occupied spectral regions, tracks them across frames, and attaches evidence-based service candidates from a selectable FCC/United States allocation profile. Confirmed FM broadcast stations are additionally eligible for RDS/RBDS decoding, which adds transmitted station identity and program metadata when the subcarrier can be synchronized.

Up to four session VFOs can independently tune and play WBFM, AM, or NBFM inside the active capture. Audio DSP remains continuous ahead of display throttling, while a bounded AudioWorklet mixer provides per-VFO gain, mute, solo, squelch, and master output control.

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

The generator also includes fixed **FM + RDS**, **AM**, and **NBFM** presets. They emit deterministic audio modulation for exercising each receiver mode without radio hardware; the FM preset includes a stereo multiplex and RBDS group cycle at 100.1 MHz.

## Audio VFOs

Choose a generator preset or start HackRF reception, then use **Add VFO** or **Add receiver** on a detected signal. Set the absolute frequency, demodulation mode, bandwidth, squelch, and mixer gain before selecting **Play**. Browser autoplay policy requires that explicit Play gesture before the AudioContext starts.

VFO definitions remain available for the page session when a source stops or changes. A receiver outside the active source passband remains visible and silent until source tuning covers its full channel and filter transition. Audio is currently WBFM mono, AM, or NBFM; the block and mixer contracts retain channel-count metadata for future WBFM stereo.

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

The paced display/DSP lane subtracts the independent I/Q means from each complete FFT block so HackRF's converter offset does not appear as a false zero-frequency spectral peak or drive automatic gain. Continuous raw RDS decoding remains unchanged.

**Auto optimize** is an optional, session-only control for a detected signal. It follows the explicitly selected signal row, or a sticky strongest stable signal when none is selected, and can adjust center frequency plus LNA/VGA gain while reception remains active. Manual center or gain changes disable it. Sample rate, baseband filter, RF amplifier, and antenna bias remain manual; automatic gain decisions use relative spectrum dBFS as a headroom proxy rather than calibrated power or true ADC clipping telemetry.

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
| `npm run test:e2e` | Build and test the production bundle, then run source-module browser integrations |
| `npm run rust:fmt-check` | Verify Rust formatting |
| `npm run rust:lint` | Run Clippy with warnings denied |
| `npm run rust:test` | Run native Rust workspace tests |
| `npm run build` | Build release WASM and the production frontend |
| `npm run validate` | Run the complete local equivalent of CI |

For strict Rust linting:

```powershell
npm run rust:fmt-check
npm run rust:lint
```

## Continuous integration

Pull requests, merge-queue commits, and pushes to `main` run the complete validation suite on Ubuntu and Windows. The functional Playwright scenarios load the release build from a nested `/ci/` path, proving that its relative JavaScript, WASM, worker, and AudioWorklet assets remain deployable at either an HTTPS origin root or a subpath. Two `@source` analyzer integrations run separately through Vite because they intentionally import internal TypeScript modules that are not part of the public bundle.

After a successful Ubuntu validation, CI retains the exact `dist/` output as `rad-io-dist-<commit SHA>` for 14 days. A future deployment workflow should wait for the complete operating-system matrix and promote that artifact without rebuilding it. The production host must use HTTPS, serve `.wasm` as `application/wasm`, cache hashed assets immutably, and keep `index.html` refreshable.

Native and browser benchmarks run weekly and on manual dispatch. They remain outside required checks: harness failures and existing real-time sanity assertions can mark a benchmark run red, but historical metric changes do not gate pull requests. Hosted CI does not access physical radio hardware; the required HackRF Playwright scenarios use a deterministic WebUSB device simulation.

## Architecture

The main thread owns permission selection, controls, low-rate status, and Canvas2D rendering. A browser acquisition worker owns HackRF USB transfers plus continuous live RDS and VFO processing, while the DSP worker owns signal generation, generated RDS/VFO processing, FFT state, signal tracking/classification, and frame pacing. Demodulated blocks move directly from the active processing owner to an AudioWorklet over a transferable `MessagePort`; live IQ and audio packets are never stored in React state.

See [docs/architecture.md](docs/architecture.md) for protocol, ownership, scaling, and WebUSB integration details.
See [docs/signal-detection.md](docs/signal-detection.md) for detection behavior, metadata semantics, profile provenance, and limitations.
See [docs/rds.md](docs/rds.md) for RDS/RBDS decoding, supported groups, target selection, and data-quality semantics.
See [docs/audio.md](docs/audio.md) for VFO modes, audio ownership, buffering, mixing, and current limits.

## Scope

HackRF support is receive-only. This milestone intentionally excludes transmit, hardware sweep mode, antenna bias enablement, firmware flashing/reset, calibrated dBm measurements, audio recording, WBFM stereo recovery, SSB/CW demodulation, persistent presets, output-device routing, SharedArrayBuffer, and WebGL. RDS application groups are retained, but external TMC location/event databases and application-specific ODA semantic plugins are not bundled.
