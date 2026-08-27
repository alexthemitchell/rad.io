# RDS / RBDS Decoding

rad.io decodes the 57 kHz Radio Data System subcarrier carried by FM broadcast stations. The selected FCC profile uses North American RBDS program-type labels and derives standard sequential `K`/`W` call signs when the PI code permits it. Block and group transport remains compatible with RDS broadcasts outside North America.

## Target Selection

Only confirmed, active `fm-broadcast` tracks are candidates. A target must have an FCC channel center, must not be edge-clipped, and must leave 120 kHz between its channel center and either capture edge. The selector retains active targets to avoid repeatedly destroying decoder lock and fills vacancies by SNR, evidence score, and track tenure. Full-rate channelization is budgeted to remain real-time: up to four stations are decoded at 2 or 5 MS/s, two at 10 MS/s, and one at 20 MS/s.

Metadata is keyed by channel center rather than transient track ID. It remains visible while the track is `recent`, becomes `stale` after two seconds of source time without a valid group, and is removed when the track expires. Retuning, changing sample rate or profile, resetting, stopping, and acquisition discontinuities clear decoder state.

## Signal Path

For each target, the Rust decoder:

1. Frequency-shifts and decimates complex IQ to a 250 kS/s FM channel.
2. Applies a phase-difference FM discriminator.
3. Mixes the 57 kHz subcarrier to baseband and low-pass filters it.
4. Resamples to 19 kS/s, giving 16 samples per 1,187.5 bit/s symbol.
5. Evaluates parallel symbol-phase hypotheses and differentially decodes the biphase symbols.
6. Acquires 26-bit block alignment from the RDS offset words, applies bounded single-bit correction after alignment, and assembles 104-bit groups.

Generated mode processes a continuous source-time interval for every displayed frame and analyzes only its newest FFT window. Live HackRF decoding runs over every raw USB transfer in the acquisition worker before the lower-rate display snapshot path. This separation prevents animation-frame backpressure from breaking RDS continuity.

## Data Coverage

Every group variant from `0A` through `15B` is identified and retained in a bounded raw history. The decoder currently promotes these self-contained values into the station summary:

- PI and standard sequential US call sign
- PS, stabilized after two matching complete cycles
- RBDS PTY and PTYN
- TP, TA, music/speech, and decoder-information flags
- alternative frequencies
- extended country code and program item number
- RadioText 2A/2B with A/B invalidation and carriage-return termination
- clock time/date and local offset
- ODA registrations
- numeric TMC and EON envelopes

Paging, TDC, in-house applications, unknown ODAs, and other application-dependent groups remain available as raw type/version, block, AID, correction, and timestamp records. rad.io does not bundle TMC event/location databases or arbitrary ODA plugins, so it does not invent human-readable meanings for those payloads.

Basic text decoding accepts printable ASCII and common NUL padding used by North American broadcasters. Unsupported extended EN 50067 character-table entries are shown with a replacement character rather than guessed.

## Synthetic Preset

The generator's **FM + RDS** mode emits one fixed station:

- RF channel: 100.1 MHz
- PS: `RAD.IO`
- PI: `0x3CE7`
- Derived call sign: `KRAD`
- RBDS PTY: Information
- PTYN: Public
- RadioText: `RAD.IO synthetic RBDS test station`

The signal contains stereo audio tones, a 19 kHz pilot, a 38 kHz stereo-difference subcarrier, and a 57 kHz RDS subcarrier. Its deterministic group cycle covers core metadata plus representative ODA, TMC, EON, and raw application records for automated browser testing.

## Live Hardware Cross-Check

An over-the-air HackRF capture on 2026-08-27 independently verified the decoder against GNU Radio's `gnuradio-rds` implementation. With the receiver centered at 91.05 MHz, the 91.3 MHz station produced 44 valid GNU Radio groups in four seconds. GNU Radio reported PI `0x187F`, North American PTY `Religious Music`, and RadioText `"I Will Worship You" Matthew Ward`.

rad.io locked to the same broadcast and reported the same PI, PTY, and RadioText, derived call sign `KDFR`, and accumulated 56 valid groups with 8 corrected blocks during the comparison. This verifies interoperability with a real broadcast independently of the synthetic encoder/decoder round trip.

## Quality Indicators

The detail view distinguishes `searching`, `locked`, `stale`, `capacity-limited`, and `unavailable`. A targeted station changes from `searching` to `unavailable` after five seconds without a valid group, with an explicit note that the station may not transmit RDS or reception may be insufficient. Diagnostics report valid groups, corrected blocks, rejected groups, lock losses, and the source timestamp of the most recent valid group. Values are not persisted between sessions.
