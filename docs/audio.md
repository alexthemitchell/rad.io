# Multi-VFO Audio

## Scope

rad.io supports up to four user-managed receivers inside one generated or HackRF capture. A VFO has a session-stable ID, absolute RF frequency, mode, channel bandwidth, squelch threshold, DSP revision, label, gain, mute, and solo state.

Implemented demodulators:

| Mode | Default channel | Audio processing |
| --- | ---: | --- |
| WBFM | 200 kHz | mono L+R, 15 kHz low-pass, DC block, 75 us de-emphasis |
| AM | 10 kHz | envelope detector, DC/carrier removal, 5 kHz low-pass, bounded attack/release gain |
| NBFM | 12.5 kHz | 2.5 kHz-deviation scaling, 3 kHz low-pass, DC block, 300 us de-emphasis |

WBFM stereo recovery, SSB/CW, recording, output-device selection, spatial routing, and persisted presets are not implemented.

## Ownership

Continuous IQ branches to the VFO bank before FFT/display pacing. Generated IQ is processed in the DSP worker. Signed-byte HackRF IQ is processed in the acquisition worker; when WebUSB is unavailable in workers, the page owns only USB transport and display assembly while a processing-only worker retains VFO and RDS DSP. The active owner receives only DSP fields, while gain, mute, and solo remain in the AudioWorklet domain.

```text
continuous source IQ
  -> shared-input Rust/WASM VFO bank
       -> target NCO
       -> bounded CIC coarse decimation
       -> FIR channel filter and decimation
       -> WBFM / AM / NBFM demodulator
       -> streaming resampler at AudioContext.sampleRate
       -> approximately 20 ms Float32 blocks
  -> transferable MessagePort
  -> AudioWorklet bounded queues and mixer
  -> AudioContext destination
```

The main thread attaches a fresh producer `MessagePort` whenever processing ownership changes. Audio blocks do not pass through React or the analyzer snapshot. The worklet control port carries gain/mute/solo/master updates and diagnostics sampled at four updates per second.

## Buffering And Mixing

The worklet prebuffers about 100 ms and caps each VFO near 250 ms. Overflow drops oldest frames to bound latency. An initial start waits for the prebuffer; after playback has started, an underrun outputs silence but resumes on the next complete render quantum instead of imposing another 100 ms pause. Tune/mode revision changes, source changes, pause, reset, and discontinuities flush stale audio.

Enabled VFOs are summed with per-VFO dB gain. Mute removes one VFO. If any unmuted VFO is soloed, only unmuted solo VFOs are mixed. Master mute continues consuming queues. An immediate-attack, gradual-release limiter holds output below approximately -1 dBFS. Mono blocks are duplicated to both output channels; the transport accepts stereo blocks for a future WBFM decoder.

## Lifecycle

Browser autoplay rules require the explicit Play action. That action creates or resumes one playback-latency `AudioContext`, loads the worklet, reads its negotiated sample rate, configures the active source bank, and transfers a producer port. Live mixer changes reuse the graph. Pause disables source-side VFO processing, flushes queues, and suspends the context.

HackRF bulk input uses 256 KiB processing chunks and keeps approximately 50 ms of reads in flight: one at 2 MS/s, two at 5 MS/s, four at 10 MS/s, and eight at 20 MS/s. USB input therefore continues while the current chunk is demodulated. Development WASM uses optimized DSP codegen so its live processing behavior matches the release performance envelope while retaining debug information.

VFO definitions are page-session state. They survive source stop/switch but are not persisted across reload. A VFO whose channel plus filter transition touches or exceeds the source Nyquist boundary is shown as out of band, omitted from DSP configuration, and automatically reactivated when the capture covers it.

## Evidence And Limits

Rust regressions recover deterministic WBFM, AM, and NBFM tones across irregular chunks, verify signed-byte WBFM input, and separate four simultaneous NBFM channels. Browser tests run each generated mode through the real AudioWorklet, exercise four-VFO controls and queue diagnostics, and verify desktop/mobile layout.

Native and release-browser throughput are recorded in [Performance](performance.md). These tests prove deterministic DSP and browser integration. They are not independent live-RF proof. Hardware claims require bounded receive-only IQ capture and agreement with an independent demodulator as described by the repository hardware-verification workflow.

On 2026-08-28, a receive-only HackRF One (`2021.03.1`, API 1.04) soak used a 91.05 MHz center, a 91.3 MHz WBFM VFO, FFT 2,048, LNA 16 dB, VGA 20 dB, RF amp off, antenna bias off, and the attached station antenna. Baseband filters were 1.75, 3.5, 7, and 15 MHz at 2, 5, 10, and 20 MS/s respectively. Each rate ran for about 13 seconds across foreground, an eight-second minimized-window interval, and resumed playback. All twelve checkpoints reported zero AudioWorklet underruns and zero overruns while analyzer frames continued advancing. This verifies live acquisition and audio transport continuity; it is not an independent assessment of demodulated audio fidelity.
