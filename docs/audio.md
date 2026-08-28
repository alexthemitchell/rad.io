# Multi-VFO Audio

## Scope

rad.io supports up to four user-managed receivers inside one generated or HackRF capture. A VFO has a session-stable ID, absolute RF frequency, mode, channel bandwidth, squelch threshold, DSP revision, label, gain, mute, and solo state.

Implemented demodulators:

| Mode | Default channel | Audio processing |
| --- | ---: | --- |
| WBFM | 200 kHz | automatic pilot-locked stereo, smooth mono blend, 15 kHz low-pass, DC block, 75 us per-channel de-emphasis |
| AM | 10 kHz | envelope detector, DC/carrier removal, 5 kHz low-pass, bounded attack/release gain |
| NBFM | 12.5 kHz | 2.5 kHz-deviation scaling, 3 kHz low-pass, DC block, 300 us de-emphasis |

SSB/CW, recording, output-device selection, spatial routing, and persisted presets are not implemented.

## Ownership

Continuous IQ branches to the VFO bank before FFT/display pacing. Generated IQ is processed in the DSP worker. Signed-byte HackRF IQ is processed in the acquisition worker; when WebUSB is unavailable in workers, the page owns only USB transport and display assembly while a processing-only worker retains VFO and RDS DSP. The active owner receives only DSP fields, while gain, mute, and solo remain in the AudioWorklet domain.

```text
continuous source IQ
  -> shared-input Rust/WASM VFO bank
       -> target NCO
       -> bounded CIC coarse decimation
       -> FIR channel filter and decimation
        -> WBFM stereo / AM / NBFM demodulator
       -> streaming resampler at AudioContext.sampleRate
       -> approximately 20 ms Float32 blocks
  -> transferable MessagePort
  -> AudioWorklet bounded queues and mixer
  -> AudioContext destination
```

The main thread attaches a fresh producer `MessagePort` whenever processing ownership changes. Audio blocks do not pass through React or the analyzer snapshot. The worklet control port carries gain/mute/solo/master updates and diagnostics sampled at four updates per second.

## WBFM Stereo

The WBFM discriminator runs at a source-derived narrowband rate: 250 kS/s for the current 2, 5, 10, and 20 MS/s source rates, and 300 kS/s for the supported 2.4 MS/s path. A narrow complex tracker recovers the 19 kHz pilot phasor and squares it to regenerate a coherent 38 kHz reference. Separate low-pass paths recover L+R and L-R before channel matrixing, 75 us de-emphasis, DC blocking, and paired resampling to the AudioContext rate.

Pilot strength drives an asymmetric smooth blend: stereo enters quickly on a usable pilot and returns more slowly to mono so fading does not hard-switch the soundstage. Lock indication uses separate acquire/release thresholds. Every WBFM block remains two-channel during fallback, with the mono sum duplicated to left and right, so queue framing never changes while receiving. `ST` means the current decoder revision is pilot-locked, `MONO` means a current block is using fallback, and `--` means no current status is available. This state is independent of the RDS stereo flag.

## Buffering And Mixing

The worklet prebuffers about 100 ms and caps each VFO near 250 ms. Overflow drops oldest frames to bound latency. An initial start waits for the prebuffer; after playback has started, an underrun outputs silence but resumes on the next complete render quantum instead of imposing another 100 ms pause. Tune/mode revision changes, source changes, pause, reset, and discontinuities flush stale audio.

Enabled VFOs are summed with per-VFO dB gain. Mute removes one VFO. If any unmuted VFO is soloed, only unmuted solo VFOs are mixed. Master mute continues consuming queues. An immediate-attack, gradual-release limiter holds output below approximately -1 dBFS. AM and NBFM blocks are duplicated to both output channels; WBFM blocks contain interleaved `[L0, R0, L1, R1, ...]` frames.

## Lifecycle

Browser autoplay rules require the explicit Play action. That action creates or resumes one playback-latency `AudioContext`, loads the worklet, reads its negotiated sample rate, configures the active source bank, and transfers a producer port. Live mixer changes reuse the graph. Pause disables source-side VFO processing, flushes queues, and suspends the context.

HackRF bulk input uses 256 KiB processing chunks and keeps approximately 50 ms of reads in flight: one at 2 MS/s, two at 5 MS/s, four at 10 MS/s, and eight at 20 MS/s. USB input therefore continues while the current chunk is demodulated. Development WASM uses optimized DSP codegen so its live processing behavior matches the release performance envelope while retaining debug information.

VFO definitions are page-session state. They survive source stop/switch but are not persisted across reload. A VFO whose channel plus filter transition touches or exceeds the source Nyquist boundary is shown as out of band, omitted from DSP configuration, and automatically reactivated when the capture covers it.

## Evidence And Limits

Rust regressions recover deterministic WBFM stereo, AM, and NBFM tones across irregular chunks, verify signed-byte WBFM input, exercise pilot phase/frequency error and hysteretic fallback, reject pilot aliases at the minimum output rate, and separate four simultaneous NBFM channels. Browser tests run each generated mode through the real AudioWorklet, observe WBFM lock, exercise four-VFO controls and queue diagnostics, and verify desktop/mobile layout.

A separate two-second signed-byte synthetic control was decoded through both the production `VfoBank` and an independent GNU Radio 3.10.12/SciPy 1.15.2 chain. The reference measured a 19,000.02 Hz pilot at 0.089 amplitude. Product/reference normalized correlations were 0.998 left and 0.995 right; correct channel pairing scored 0.997 versus 0.058 swapped, and L-R/L+R power differed by 0.30 dB. This proves the file paths and deterministic stereo regression, not over-the-air behavior.

On 2026-08-28, an eight-second receive-only HackRF capture of 97.3 MHz used a 97.05 MHz center, 2 MS/s sample rate, 1.75 MHz filter, LNA 16 dB, VGA 20 dB, RF amp off, and antenna bias off. The production decoder reported lock for 100% of 384,000 frames. The independent chain measured a 19,000.29 Hz pilot at 0.0877 amplitude; product/reference correlations were 0.981 left and 0.981 right, and L-R/L+R power differed by 0.43 dB. Correct pairing scored 0.981 versus 0.970 swapped. The program material was highly correlated at -21.6 dB L-R/L+R, so the capture strongly verifies pilot recovery and waveform agreement but provides only directional channel-order evidence.

Native and release-browser throughput are recorded in [Performance](performance.md). These tests prove deterministic DSP and browser integration. They are not independent live-RF proof. Hardware claims require bounded receive-only IQ capture and agreement with an independent demodulator as described by the repository hardware-verification workflow.

On 2026-08-28, a receive-only HackRF One (`2021.03.1`, API 1.04) soak used a 91.05 MHz center, a 91.3 MHz WBFM VFO, FFT 2,048, LNA 16 dB, VGA 20 dB, RF amp off, antenna bias off, and the attached station antenna. Baseband filters were 1.75, 3.5, 7, and 15 MHz at 2, 5, 10, and 20 MS/s respectively. Each rate ran for about 13 seconds across foreground, an eight-second minimized-window interval, and resumed playback. All twelve checkpoints reported zero AudioWorklet underruns and zero overruns while analyzer frames continued advancing. This verifies live acquisition and audio transport continuity; it is not an independent assessment of demodulated audio fidelity.
