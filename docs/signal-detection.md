# Automatic Signal Detection

rad.io detects occupied spectral regions inside the IQ bandwidth currently supplied to the analyzer. Detection itself does not scan outside that capture. An optional HackRF-only **Auto optimize** control can follow one already-detected signal by adjusting center frequency and receive gain; it does not perform a band scan.

## Processing Pipeline

Each FFT frame passes through these stages:

1. `dsp-core` applies the existing Hann window, shifted FFT, and dBFS normalization.
2. The detector estimates the noise floor from the lower 20th percentile of finite spectrum bins while excluding two bins on either side of DC.
3. Bins at least 15 dB above that floor are considered occupied for generated IQ. HackRF starts at 25 dB to reject persistent low-level converter and receiver artifacts; each source retains its own adjustable UI threshold.
4. Adjacent occupied bins are grouped, with a one-bin gap merged to tolerate spectral nulls. An isolated center spike is suppressed, while a wide occupied region spanning the DC guard remains intact. Each frame returns at most 16 strongest regions.
5. A candidate at least 20 dB below a stronger occupied region and within 24 FFT bins of it is treated as unresolved window leakage rather than a separate signal.
6. The worker associates regions across frames with maximum-cardinality matching. Occupied-range overlap remains the strongest evidence, while a bounded drift gate tolerates receiver shake of up to 2.5% of capture bandwidth (capped at 50 kHz). Augmenting-path assignment keeps nearby signals distinct when they move together instead of greedily consuming the nearest track. Published geometry uses a timestamp-based 250 ms low-pass filter, while level and SNR use a 125 ms filter; raw per-frame detections remain unchanged. A track becomes visible after three matching frames, remains `recent` for up to 15 missed frames, and is then removed.
7. Confirmed tracks are compared with the selected local allocation profile. The default is `FCC / United States`; selecting `None` leaves measured metadata intact and disables service matching.
8. Up to four active FM-broadcast tracks with sufficient capture headroom become sticky RDS targets. Existing targets retain their slots while active; vacancies are filled by signal-to-noise ratio, classification evidence, and track tenure.

For external IQ, an FM allocation match enters the station inventory only after its consolidated channel has shown more than 25 kHz of occupied span. That qualification is retained through narrower modulation moments and the track's `recent` lifetime. This hysteresis prevents persistent narrow receiver or converter spurs inside the FM band from being presented as additional broadcast stations.

The inventory keeps active and recent groups separate, then orders each group by frequency rather than fluctuating signal level. When classification supplies an AM or FM channel center, the inventory frequency and spectrum marker stay anchored to that center, and the yellow highlight uses the fixed allocation channel envelope. The occupied range in signal details continues to report filtered measurements. The instantaneous global-peak cursor remains visible during track confirmation, then yields to confirmed signal markers so strongest-bin changes do not appear as station motion.

The tracker holds no unbounded history. Active and provisional state is capped at 64 tracks, and React samples only the compact latest snapshot every 250 ms.

## HackRF Auto Optimization

Auto optimization is off by default and lasts only for the current receiver session. It uses the explicitly selected signal row when that signal is eligible; without an explicit selection, it acquires the strongest stable signal by SNR, peak level, classification evidence, and tenure. Eligible targets must be active, not edge-clipped, visible for at least six observations and one second, and have an absolute RF frequency. Allocation channel center is the stable identity when available; otherwise the measured absolute peak is used. Matching within 50 kHz preserves intent across tracker-ID replacement, and an automatically acquired target remains sticky through a two-second absence.

If the target is too close to DC or a capture edge, the optimizer places it at a preferred $+250$ kHz or $-250$ kHz offset, choosing the valid center closest to the current tuning. It preserves a 120 kHz DC guard and 120 kHz of capture-edge headroom, rejects signals that do not fit at the current sample rate, and suppresses retunes within a 25 kHz deadband. Sample rate and baseband filter remain manual.

Gain control aggregates four 250 ms UI observations and permits only one acknowledged command at a time, followed by a one-second settling interval. A global spectral peak above -8 dBFS backs off VGA in 2 dB steps before LNA in 8 dB steps. Below the -18 to -10 dBFS operating band, it probes one LNA step and retains that step only when median target SNR improves by at least 0.5 dB; VGA then provides finer adjustment. The RF amplifier and antenna bias are never enabled by this feature.

These thresholds use FFT dBFS as conservative digital headroom evidence. They do not measure calibrated input power, identify the analog stage causing compression, or prove ADC clipping. A manual center-frequency, LNA, or VGA change disables automation immediately. Turning off detection, stopping or changing source, reset, command failure, and explicit disable also stop new optimization commands.

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
- the matched allocation channel center, used as the stable key for optional RDS metadata

When RDS synchronizes, the track can additionally include PI/call sign, PS, PTY/PTYN, traffic and decoder flags, alternative frequencies, RadioText, clock time, ODA registrations, EON/TMC envelopes, decoder quality, and recent raw groups. These values are decoded evidence rather than allocation guesses. See [rds.md](rds.md) for field and freshness semantics.

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

Allocation match and modulation identification remain separate. An FM allocation match makes a track eligible for RDS decoding, but the UI reports station identity only after valid RDS blocks synchronize. Amateur allocations permit many modes, so their profile does not impose one expected bandwidth.

Signals that touch a capture edge are marked `partial`; their bandwidth is a lower bound and their evidence score is capped. Television channels are wider than the current generated sample-rate choices, so a TV candidate will normally carry this partial-capture caveat unless wider external IQ is supplied.

## Current Limitations

- Levels are relative dBFS, not calibrated RF power or dBm.
- The noise estimate is frame-local and is not a hardware noise calibration.
- Auto optimization uses spectral dBFS as a headroom proxy, not true ADC-overload telemetry.
- HackRF display blocks have their complex mean removed, and the detector retains a DC guard. A narrow signal exactly at zero offset is intentionally indistinguishable from receiver offset; tune it away from DC for measurement.
- A strong off-bin carrier can produce window sidelobes; the 15 dB default threshold reduces these false candidates and can be adjusted for a source.
- User-created VFOs provide WBFM mono, AM, and NBFM audio playback. There is no SSB, Morse or time-code decoding, speech analysis, or external station directory.
- RDS supports the complete group transport envelope, but application-specific ODA semantics and TMC event/location text require external specifications or regional databases and remain raw numeric data.
- Service candidates depend on the accuracy and revision of the selected allocation profile. Actual authorization and usage can vary by location, license, channel, and time.

Future demodulators or directory lookups should consume confirmed tracks as additional evidence and publish their own provenance. They should not replace measured spectral fields or reinterpret the current evidence score as decoded certainty.
