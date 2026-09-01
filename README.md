# rad.io

A browser-based signal analyzer and multi-VFO receiver with DSP implemented in Rust, compiled to WebAssembly, and isolated in dedicated web workers.

The analyzer accepts a deterministic complex IQ generator or live RF from HackRF One and RTL2832U/Elonics E4000 receivers connected directly through WebUSB. Up to two distinct hardware devices can run concurrently; each retains its own analyzer, detection, RDS, VFO, and optimization state while the selected tab controls the rendered view. The generator is exclusive with live hardware. Hardware support runs in the browser without `libhackrf`, `librtlsdr`, a native helper, or a browser extension.

The detector estimates the noise floor, extracts multiple occupied spectral regions, tracks them across frames, and attaches evidence-based service candidates from a selectable FCC/United States allocation profile. Confirmed FM broadcast stations are additionally eligible for RDS/RBDS decoding, which adds transmitted station identity and program metadata when the subcarrier can be synchronized.

Up to four global VFOs can independently tune and play WBFM, AM, or NBFM inside their owning source captures. WBFM automatically recovers broadcast stereo and smoothly blends to mono when the 19 kHz pilot is weak. Source-keyed producer ports feed one bounded AudioWorklet mixer, which rate-matches each independent hardware clock and provides per-VFO gain, mute, solo, squelch, and master output control without merging IQ streams.

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

Choose a generator preset or start one or two hardware sessions, then use **Add VFO** or **Add receiver** on a detected signal. Set the absolute frequency, demodulation mode, bandwidth, squelch, and mixer gain before selecting **Play**. Each VFO keeps its source-session identity, and the global four-VFO budget can span both radios. Browser autoplay policy requires that explicit Play gesture before the shared AudioContext starts.

VFO definitions remain available for the page session when their source stops or another source is selected. A receiver outside its owning source's passband remains visible and silent until that source covers its full channel and filter transition. WBFM emits interleaved stereo and displays `ST` while pilot-locked or `MONO` while using its smooth fallback. AM and NBFM remain mono and are duplicated across the output pair by the mixer.

The HackRF One source starts with conservative receive-only settings:

- 100 MHz center frequency
- 2 MS/s complex sample rate
- 1.75 MHz baseband filter
- 2,048-point FFT at up to 30 analysis frames per second
- 16 dB LNA gain and 20 dB VGA gain
- RF amplifier and antenna bias power off
- 25 dB minimum detection SNR, with independent adjustment from generated IQ

## HackRF One

Select **Add device**, then choose an already authorized HackRF or **Pair new device** and use Chromium's USB picker. Later sessions reuse the origin's retained permission through the in-app authorized-device menu. The browser pins the exact selected device, opens its vendor interface, configures receive mode, and streams signed 8-bit interleaved IQ into that session's Rust/WASM analyzer. Stop returns the radio to transceiver-off mode and closes the browser USB session without revoking permission.

The paced display/DSP lane subtracts the independent I/Q means from each complete FFT block so HackRF's converter offset does not appear as a false zero-frequency spectral peak or drive automatic gain. Continuous raw RDS decoding remains unchanged.

**Auto optimize** is optional and independent for every hardware session. It follows that session's explicitly selected signal row, or a sticky strongest stable signal when none is selected. HackRF optimization can adjust center frequency plus LNA/VGA gain; RTL-SDR optimization uses center frequency plus the E4000's discrete tuner-gain steps and takes manual ownership from AGC at 24 dB. Manual center or gain changes disable only that session's optimizer. Sample rate, baseband filter, RF amplifier, bias power, and direct-sampling selection remain manual; automatic gain decisions use relative spectrum dBFS as a headroom proxy rather than calibrated power or true ADC clipping telemetry.

The implementation is platform-neutral and contains no OS detection or native fallback. Windows can bind HackRF firmware's `USB\MS_COMP_WINUSB` identity to the inbox WinUSB service; macOS exposes the device through its USB stack. Some Linux host policies deny browser access to raw USB device nodes. A sandboxed page cannot alter that policy, so rad.io reports the host denial rather than installing or invoking system software.

## RTL-SDR E4000

Select **Add device**, then choose an authorized RTL-SDR or **Pair new device**. The implemented profile supports generic RTL2832U IDs `0bda:2832` and `0bda:2838` when the tuner probe identifies an Elonics E4000. Other tuner families fail explicitly rather than using E4000 gain or frequency assumptions. Windows must expose interface 0 through WinUSB; changing a host driver remains a user-controlled setup operation.

The default is 100 MHz at 2.4 MS/s, FFT 2,048, automatic tuner gain, zero PPM correction, tuner input, and bias power off. Stable selectable rates are 1.024, 2.048, and 2.4 MS/s. The tuner path covers 50 MHz through 2.2 GHz. Direct I/Q sampling can be armed for frequencies at or below 28.8 MHz; 28.8–50 MHz is rejected because neither path covers it. Center, gain, PPM, direct-input method, and bias changes are serialized and acknowledged while running.

RTL bulk input is unsigned interleaved `[I, Q]`. Acquisition flips each byte's sign bit once in place, then shares the signed-byte RDS/VFO processing used by other hardware. Two 65,536-sample reads remain queued so DSP and rendering do not pause USB input. A discontinuity command pauses and drains those reads before touching the tuner, resets the FIFO, discards settling samples, tolerates bounded transient post-reset transfer failures, and restores absolute VFO routes after acknowledgement. Old center-relative RDS targets remain cleared until fresh detections supply new offsets. Display backpressure retains one reusable Float32 buffer and never interrupts continuous RDS/audio processing.

Bias power requires an explicit confirmation and is forced off during startup, shutdown, errors, and reconnects. Enabling the control does not prove that a particular dongle implements a bias tee; confirm the connected antenna and hardware independently before using it.

Run the opt-in physical browser check from PowerShell with the receiver released by native tools:

```powershell
$env:RAD_RTL_SDR_HARDWARE = '1'
npx playwright test e2e/rtl-sdr.hardware.spec.ts --config playwright.config.ts --headed
Remove-Item Env:RAD_RTL_SDR_HARDWARE
```

WebUSB is not implemented by Firefox or Safari. Production hosting must use HTTPS; loopback development URLs are treated as secure contexts by Chromium.

## Commands

| Command | Purpose |
| --- | --- |
| `npm run wasm:dev` | Build unoptimized browser WASM bindings |
| `npm run wasm:release` | Build release browser WASM bindings |
| `npm run type-check` | Run strict TypeScript checking |
| `npm run lint` | Lint authored TypeScript and React code |
| `npm test` | Run Vitest unit tests |
| `npm run test:e2e` | Build and test the required browser flows, then run source-module browser integrations |
| `npm run test:e2e:stability` | Build and run serial production audio underrun stability checks |
| `npm run rust:fmt-check` | Verify Rust formatting |
| `npm run rust:lint` | Run Clippy with warnings denied |
| `npm run rust:test` | Run native Rust workspace tests |
| `npm run build` | Build release WASM and the production frontend |
| `npm run validate` | Run the required Ubuntu validation suite |
| `npm run validate:windows` | Run the reduced Windows portability suite |

For strict Rust linting:

```powershell
npm run rust:fmt-check
npm run rust:lint
```

## Continuous integration

Pull requests, merge-queue commits, and pushes to `main` run the full required validation suite on Ubuntu and a smaller portability check on Windows. Ubuntu executes `npm run validate`, including the functional Playwright release scenarios that load the bundle from a nested `/ci/` path and prove that its relative JavaScript, WASM, worker, and AudioWorklet assets remain deployable at either an HTTPS origin root or a subpath. Three `@source` analyzer scenarios run separately through Vite because they intentionally exercise internal source modules that are not part of the public bundle. Windows retains MSVC Rust lint and test coverage plus the production build without gating on timing-sensitive browser audio underrun assertions.

After a successful Ubuntu validation, CI retains the exact `dist/` output as `rad-io-dist-<commit SHA>` for 14 days. Successful pushes to `main` promote that validated artifact to GitHub Pages without rebuilding it. The production host must use HTTPS, serve `.wasm` as `application/wasm`, cache hashed assets immutably, and keep `index.html` refreshable.

Native and browser benchmarks run weekly and on manual dispatch. A separate serial Windows audio stability workflow runs the strict `0 underruns` assertions on the same non-gating cadence. These auxiliary workflows can mark a run red, but they do not gate pull requests. Hosted CI does not access physical radio hardware; required HackRF and RTL-SDR browser scenarios use deterministic WebUSB device simulations. The opt-in `e2e/rtl-sdr.hardware.spec.ts` test requires an attached E4000 receiver and `RAD_RTL_SDR_HARDWARE=1`.

## Architecture

The main thread owns permission selection, the two-session manager, controls, low-rate status, and selected-view Canvas2D rendering. Each hardware session owns a source-specific acquisition worker, analyzer DSP worker, frame hub, detector, optimizer, and continuous live RDS/VFO processor. Demodulated blocks move from every active processing owner to one AudioWorklet over source-keyed transferable `MessagePort` instances; live IQ and audio packets are never stored in React state.

See [docs/architecture.md](docs/architecture.md) for protocol, ownership, scaling, and WebUSB integration details.
See [docs/signal-detection.md](docs/signal-detection.md) for detection behavior, metadata semantics, profile provenance, and limitations.
See [docs/rds.md](docs/rds.md) for RDS/RBDS decoding, supported groups, target selection, and data-quality semantics.
See [docs/audio.md](docs/audio.md) for VFO modes, audio ownership, buffering, mixing, and current limits.

## Scope

Hardware support is receive-only. This milestone intentionally excludes transmit, hardware sweep mode, HackRF antenna bias, firmware flashing/reset, calibrated dBm measurements, coherent combination of independent radio clocks, more than two hardware sessions, audio recording, SSB/CW demodulation, persistent presets, output-device routing, SharedArrayBuffer, and WebGL. RTL bias control is guarded and off by default; live bias-voltage verification is outside the browser. RDS application groups are retained, but external TMC location/event databases and application-specific ODA semantic plugins are not bundled.
