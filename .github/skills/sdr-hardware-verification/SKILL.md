---
name: sdr-hardware-verification
description: 'Diagnose and prove SDR/DSP correctness with code-level hypotheses, deterministic regressions, real HackRF IQ captures, Playwright/CDP inspection, and independent GNU Radio cross-checks. Use when signal detection, tracking, demodulation, RDS metadata, spectrum rendering, RF artifacts, WebUSB acquisition, or radio protocol output seems wrong; when synthetic tests pass but live RF fails; or when asked to prove behavior against hardware.'
argument-hint: 'Describe the suspected SDR/DSP issue and expected over-the-air behavior'
user-invocable: true
disable-model-invocation: false
---

# SDR Hardware Verification

Use this workflow to decide whether an observed radio behavior is caused by application code, receiver configuration, RF conditions, or an absent over-the-air service. The goal is independently supported evidence, not merely a passing self-generated loopback.

## Non-Negotiable Rules

- Start from one falsifiable code-path hypothesis and one cheap discriminating test.
- Treat a synthetic generator decoded by the same implementation as a regression check, not independent proof.
- Use receive-only HackRF operations. Never invoke `hackrf_transfer -t` or any transmit mode. Keep RF amp and antenna bias off unless the user explicitly requests and understands the hardware implications.
- Release WebUSB ownership before invoking `hackrf_transfer`, GNU Radio hardware sources, or another native owner.
- Bound every capture by sample count or duration. Store temporary IQ under `test-results/hardware-verification/`; never commit raw captures by default.
- Record center frequency, sample rate, filter bandwidth, LNA/VGA gain, amplifier state, antenna, timestamp, and station offset with every result.
- Compare semantic outputs from independent implementations: frequencies, IDs, text, flags, group counts, error counters, and state transitions.
- Never infer a decoder bug merely because metadata is absent. First prove that the transmitted subcarrier/service exists with an independent receiver.
- Preserve unrelated worktree changes and do not weaken production thresholds only to make one capture pass.

## Evidence Ladder

Use the strongest available evidence and label it honestly:

1. **Code reasoning**: identifies a plausible controlling path; not proof.
2. **Focused deterministic test**: falsifies the local hypothesis; proves a regression boundary.
3. **Browser/mock test**: proves UI, worker, transfer, and lifecycle integration.
4. **Real IQ capture**: proves behavior under actual RF and converter artifacts.
5. **Independent decoder agreement**: strongest result. Match at least two stable semantic fields or one identifier plus payload text.

A task is not hardware-verified until levels 4 and 5 succeed, or the report explicitly states why independent verification is unavailable.

## Workflow

### 1. Establish the Code Hypothesis

Trace from the symptom to the nearest code that computes or mutates it. Typical paths are acquisition, normalization, channelization, detection, tracking, classification, demodulation, protocol parsing, serialization, and UI association.

Before editing, state:

- observed behavior
- expected behavior
- controlling symbol/path
- falsifiable hypothesis
- cheapest check that could disprove it

Add the smallest deterministic regression first. For RF shake or fragmentation, include both a one-signal jitter case and a nearby multi-signal case so tolerance changes cannot silently merge real stations.

### 2. Reproduce Through the Product

Use the normal app path before reaching for native tools. Prefer role-based Playwright interactions and capture:

- analyzer state and source configuration
- signal rows with IDs, frequencies, SNR, bandwidth, and active/recent state
- decoder state and counters
- a full-page screenshot
- several time-separated snapshots when churn is the symptom

When the browser profile already owns WebUSB permission, attach Playwright over Chrome DevTools Protocol rather than launching an isolated context. Do not call `browser.close()` on a user-owned CDP browser; let the diagnostic process exit after capture.

Load [rad.io hardware notes](./references/rad-io.md) for this repository's ports, paths, and commands.

### 3. Separate RF Facts From Product Interpretation

Ask what the capture actually proves:

- Multiple peaks at different frequencies may be real neighboring transmitters, images, intermodulation, or converter spurs rather than duplicate tracks.
- Multiple IDs at one frequency usually indicate association churn.
- Multiple spectral islands inside one service channel may require channel-level consolidation.
- A narrow carrier inside a broadcast allocation is not automatically a broadcast station.
- A strong FM pilot proves station tuning, not RDS presence.

Vary one parameter at a time: detection threshold, gain, center offset, sample rate, or antenna placement. Use before/after measurements, not visual impressions alone.

### 4. Capture Real IQ Safely

Stop the browser receiver and confirm the device is released. Capture away from DC when possible; for an FM station at $f_s$, tune the receiver near $f_s - 250\,\text{kHz}$ and pass `--station-offset 250000` to the reference decoder.

Example PowerShell capture:

```powershell
$frequencyHz = 91_300_000
$offsetHz = 250_000
$centerHz = $frequencyHz - $offsetHz
New-Item -ItemType Directory -Force test-results/hardware-verification | Out-Null
hackrf_transfer -r test-results/hardware-verification/station.i8 `
  -f $centerHz -s 2000000 -b 1750000 -l 16 -g 20 -a 0 -n 8000000
```

This records four seconds of signed interleaved 8-bit IQ. If native capture reports the device is busy, stop and close the browser source cleanly; do not kill arbitrary processes or reset the USB device first.

### 5. Find a Positive FM/RDS Control

If the requested station has no decodable RDS, scan rather than modifying the decoder blindly:

1. Take short wideband snapshots covering the FM band.
2. Rank FCC channel centers with [rank_fm_channels.py](./scripts/rank_fm_channels.py).
3. Capture the strongest candidates individually, offset from DC.
4. Run [decode_rds_capture.py](./scripts/decode_rds_capture.py) until an independent decoder returns valid groups.

Example ranking command:

```powershell
& "$HOME\radioconda\python.exe" `
  .github/skills/sdr-hardware-verification/scripts/rank_fm_channels.py `
  --sample-rate 10000000 `
  --capture 92500000=test-results/hardware-verification/scan-92500000.i8 `
  --capture 101500000=test-results/hardware-verification/scan-101500000.i8 `
  --capture 106000000=test-results/hardware-verification/scan-106000000.i8
```

### 6. Cross-Check With GNU Radio

Run the independent file decoder:

```powershell
& "$HOME\radioconda\python.exe" `
  .github/skills/sdr-hardware-verification/scripts/decode_rds_capture.py `
  test-results/hardware-verification/station.i8 `
  --sample-rate 2000000 --station-offset 250000 --pty-locale north-america
```

For RDS, compare at least:

- PI
- PS and/or RadioText
- PTY locale and label
- TP/TA and music/speech flags when available
- valid group count and observation duration

A strong 19 kHz pilot plus zero GNU Radio groups and no 57 kHz excess means the station may not transmit RDS. Report that result and find a positive control; do not fabricate metadata or endlessly increase acquisition time.

### 7. Implement the Root Fix

Make the smallest change supported by both code tests and hardware evidence. Examples:

- bounded maximum-cardinality association for RF jitter
- channel-level consolidation for fragmented modulation
- source-specific thresholds for converter artifacts
- hysteretic qualification instead of a one-frame width gate
- carrier/timing recovery improvements when an independent decoder succeeds on the same IQ and the product decoder fails
- explicit `unavailable` state when the service is absent

Do not encode one observed station frequency, PI, or payload into production logic.

### 8. Turn Evidence Into Regression Coverage

Add coverage proportional to the failure mode:

- Rust unit test for physical DSP, coding, or parser behavior
- Vitest test for tracking, association, classification, or state lifetime
- Playwright test for worker/WebUSB/UI integration
- a compact derived fixture only when licensing and repository size permit it

Prefer synthetic vectors that reproduce the physical property over committing raw IQ. Keep one independent known vector when encoder and decoder share code.

After the first edit, run the focused falsification test immediately. Finish with repository validation and strict native lint where available.

### 9. Clean Up and Report

Delete temporary IQ, converted complex files, generated flowgraphs, and one-off scripts. Preserve intentionally requested screenshots and compact reports.

Structure the final result with [the evidence template](./assets/evidence-report.md). Include:

- what was actually wrong
- what was RF/environmental rather than code
- independent reference result
- product result
- exact matching fields
- regression tests and full validation
- remaining RF/hardware uncertainty

## Exit Criteria

A successful correctness claim requires all applicable items:

- The original symptom is reproduced or measured.
- The controlling code path is identified.
- A focused regression fails before and passes after the fix.
- Hardware configuration and capture duration are recorded.
- An independent implementation processes the same RF source or capture.
- Semantic outputs agree, not just "lock" indicators.
- Device ownership is released or intentionally left running for the user.
- Temporary captures are removed.
- Focused tests and the repository validation command pass.
