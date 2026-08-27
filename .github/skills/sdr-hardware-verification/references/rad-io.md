# rad.io Hardware Verification Notes

Load this reference when applying the SDR hardware-verification workflow in this repository.

## Repository Checks

Use focused checks first, then the complete pipeline:

```powershell
npm test -- <focused-test-files>
npm run type-check
npm run lint
cargo test -p dsp-core <test-filter>
cargo clippy --workspace --all-targets -- -D warnings
npm run validate
```

Vitest does not support `--runInBand` here.

## Signal Pipeline

- Raw device ownership: `src/sources/HackRfDeviceSession.ts`
- Acquisition worker: `src/sources/hackrf.worker.ts`
- Browser source adapter: `src/sources/HackRFSource.ts`
- DSP worker: `src/workers/dsp.worker.ts`
- Rust analyzer/detector: `crates/dsp-core/src/analyzer.rs`, `detector.rs`
- Tracking/classification: `src/detection/SignalTracker.ts`, `classifySignal.ts`
- RDS physical decoder: `crates/dsp-core/src/rds/demodulator.rs`
- RDS grouping/metadata: `crates/dsp-core/src/rds/blocks.rs`, `groups.rs`, `metadata.rs`
- UI association: `src/analyzer/AnalyzerController.ts`
- Signal/RDS UI: `src/components/DetectedSignalsPanel.tsx`, `RdsStationDetails.tsx`

External HackRF IQ is signed interleaved 8-bit `[I0,Q0,I1,Q1,...]`. The browser normalizes display blocks by dividing by 128. Continuous RDS processing occurs before display throttling.

## Safe HackRF Defaults

- Receive only
- Sample rate: 2 MS/s
- Baseband filter: 1.75 MHz
- LNA gain: 16 dB
- VGA gain: 20 dB
- RF amp: off
- Antenna bias: off
- Hardware detector threshold: 25 dB

Supported app sample rates are 2, 5, 10, and 20 MS/s. LNA steps are 8 dB; VGA steps are 2 dB.
RDS concurrency is rate-limited to keep channelization real-time: four targets at 2/5 MS/s, two at 10 MS/s, and one at 20 MS/s.

## Browser Hardware Session

A normal Playwright test context does not inherit WebUSB permission. When a standalone Chrome profile was launched with remote debugging and retained device permission, find its port with:

```powershell
Get-CimInstance Win32_Process |
  Where-Object { $_.Name -match '^(chrome|msedge)\.exe$' } |
  Select-Object ProcessId,CommandLine
```

Probe a discovered port:

```powershell
Invoke-RestMethod http://127.0.0.1:9333/json/list | ConvertTo-Json -Depth 5
```

Attach without closing the user's browser:

```javascript
import { chromium } from '@playwright/test'
const browser = await chromium.connectOverCDP('http://127.0.0.1:9333')
const page = browser.contexts()
  .flatMap((context) => context.pages())
  .find((candidate) => candidate.url().includes('127.0.0.1'))
```

Let the Node process exit after inspection. Do not call `browser.close()` on the attached hardware browser.

On this workstation, the Vite server may use 5174 when 5173 is occupied. Discover the URL from process/page state instead of hardcoding it.

## Independent Toolchain

RadioConda is installed at `$HOME\radioconda` and includes:

- `hackrf_transfer.exe`
- GNU Radio
- `gnuradio-rds`
- NumPy and SciPy

Invoke its Python explicitly:

```powershell
& "$HOME\radioconda\python.exe" <script> <arguments>
```

Check prerequisites before capture:

```powershell
Get-Command hackrf_transfer,hackrf_info
& "$HOME\radioconda\python.exe" -c "import numpy, scipy, rds; from gnuradio import gr; print('ready')"
```

## FM/RDS Capture Pattern

Keep the station away from receiver DC. For 91.3 MHz, a 91.05 MHz center yields a +250 kHz station offset:

```powershell
hackrf_transfer `
  -r test-results/hardware-verification/91.3.i8 `
  -f 91050000 -s 2000000 -b 1750000 `
  -l 16 -g 20 -a 0 -n 8000000
```

Four seconds at 2 MS/s produces 8 million complex samples and a 16 MB signed-byte file.

## Proven Live Reference

On 2026-08-27, 91.3 MHz provided a positive RDS control:

- Independent GNU Radio: 44 valid groups in four seconds
- PI: `0x187F`
- North American PTY: `Religious Music`
- RadioText: `"I Will Worship You" Matthew Ward`
- rad.io: same PI, PTY, and RadioText; derived call sign `KDFR`
- rad.io comparison snapshot: 56 valid groups, 8 corrected blocks
- sustained run: more than 400 valid groups while synchronized

By contrast, 100.3 MHz had a strong 19 kHz pilot but no measurable RDS-band excess and zero GNU Radio groups. This is the canonical example of absent service versus decoder failure.

## Interpretation Pitfalls

- At 2 MS/s, several real FM stations can be visible simultaneously. Do not call different channel centers duplicate tracks without temporal evidence.
- HackRF converter spurs can be persistent and high SNR. Check occupied span and source-specific thresholds.
- A clean synthetic carrier lacks the quantization products and intermodulation seen on hardware.
- Use phase-continuous frequency changes in mocks. Hard phase resets create broadband splatter and false detections.
- Compare track IDs over time, not only row count at one instant.
- RDS PS may be dynamic. Prefer stable PI plus PTY or RadioText for independent semantic comparison.
- A station may transmit FM stereo without RDS. A 19 kHz pilot alone is not evidence of a 57 kHz data service.

## Cleanup

Stop WebUSB before native capture and reconnect it afterward only when useful to the user. Remove `.i8`, `.cf32`, generated GNU Radio flowgraphs, and temporary analysis scripts. Keep screenshots or compact JSON only when they are part of the requested evidence.
