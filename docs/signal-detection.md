# Automatic Signal Detection

rad.io detects occupied spectral regions inside the IQ bandwidth currently supplied to the analyzer. It does not tune hardware or scan frequencies outside that capture.

## Processing Pipeline

Each FFT frame passes through these stages:

1. `dsp-core` applies the existing Hann window, shifted FFT, and dBFS normalization.
2. The detector estimates the noise floor from the lower 20th percentile of finite spectrum bins while excluding two bins on either side of DC.
3. Bins at least 15 dB above that floor are considered occupied by default. The threshold is adjustable in the UI.
4. Adjacent occupied bins are grouped, with a one-bin gap merged to tolerate spectral nulls. An isolated center spike is suppressed, while a wide occupied region spanning the DC guard remains intact. Each frame returns at most 16 strongest regions.
5. A candidate at least 20 dB below a stronger occupied region and within 24 FFT bins of it is treated as unresolved window leakage rather than a separate signal.
6. The worker associates regions across frames by occupied-range overlap and FFT-bin tolerance. A track becomes visible after three matching frames, remains `recent` for up to 15 missed frames, and is then removed.
7. Confirmed tracks are compared with the selected local allocation profile. The default is `FCC / United States`; selecting `None` leaves measured metadata intact and disables service matching.

The tracker holds no unbounded history. Active and provisional state is capped at 64 tracks, and React samples only the compact latest snapshot every 250 ms.

## Reported Metadata

Per-frame spectral detections include:

- peak, lower-edge, and upper-edge offsets from the capture center
- occupied bandwidth in hertz
- peak level in dBFS
- estimated signal-to-noise ratio in decibels
- whether the occupied region touches a capture edge

Confirmed tracks additionally include:

- stable track ID and active/recent state
- absolute frequency when `centerFrequencyHz` is greater than zero
- first-seen, last-seen, duration, and observation count
- broad spectral shape: `carrier-like`, `narrowband`, `medium-band`, `wideband`, or `partial`
- primary service candidate, up to two alternatives, evidence reasons, caveats, and an evidence score

`centerFrequencyHz = 0` explicitly means baseband-only analysis. Detection still works, but the service candidate is `Unknown service` because an RF allocation cannot be matched from an offset alone.

## FCC / United States Profile

The bundled profile covers these initial service families:

- AM broadcast channels
- FM broadcast channels
- NIST WWVB at 60 kHz and standard WWV shortwave time/frequency channels
- common FCC amateur allocations from 160 m through 23 cm
- civil VHF aviation communications
- post-repack broadcast television channels 2-36, preserving the 72-76 MHz gap

The profile revision is `2026-08`. Its entries reference these official sources:

- [47 CFR 2.106 frequency allocations](https://www.ecfr.gov/current/title-47/chapter-I/subchapter-A/part-2/subpart-B/section-2.106)
- [47 CFR Part 73 broadcast services](https://www.ecfr.gov/current/title-47/chapter-I/subchapter-C/part-73)
- [47 CFR Part 87 aviation services](https://www.ecfr.gov/current/title-47/chapter-I/subchapter-D/part-87)
- [47 CFR 97.301 amateur frequency privileges](https://www.ecfr.gov/current/title-47/chapter-I/subchapter-D/part-97/section-97.301)
- [NIST radio station WWV](https://www.nist.gov/pml/time-and-frequency-division/time-distribution/radio-station-wwv)
- [NIST radio station WWVB](https://www.nist.gov/pml/time-and-frequency-division/time-distribution/radio-station-wwvb)

Band-plan data is local and deterministic. The schema supports additional national or ITU profiles without changing detector output.

## Evidence Semantics

The displayed percentage is a deterministic evidence score, not a calibrated probability. It combines:

- frequency containment and channel-center proximity
- compatibility between measured and expected occupied bandwidth
- measured SNR
- persistence across analyzed frames
- whether the full expected channel fits in the capture

Allocation match and modulation identification are deliberately separate. For example, a signal inside an FM broadcast channel receives an FM broadcast service candidate, but rad.io does not claim that the waveform has been FM-demodulated. Amateur allocations permit many modes, so their profile does not impose one expected bandwidth.

Signals that touch a capture edge are marked `partial`; their bandwidth is a lower bound and their evidence score is capped. Television channels are wider than the current generated sample-rate choices, so a TV candidate will normally carry this partial-capture caveat unless wider external IQ is supplied.

## Current Limitations

- Levels are relative dBFS, not calibrated RF power or dBm.
- The noise estimate is frame-local and is not a hardware noise calibration.
- The DC guard can suppress a narrow signal exactly at zero offset along with receiver DC leakage.
- A strong off-bin carrier can produce window sidelobes; the 15 dB default threshold reduces these false candidates and can be adjusted for a source.
- There is no AM/FM/SSB demodulation, Morse or time-code decoding, speech analysis, callsign lookup, station directory, or digital protocol decoder.
- Service candidates depend on the accuracy and revision of the selected allocation profile. Actual authorization and usage can vary by location, license, channel, and time.

Future demodulators or directory lookups should consume confirmed tracks as additional evidence and publish their own provenance. They should not replace measured spectral fields or reinterpret the current evidence score as decoded certainty.
