# Multi-VFO Audio

## Scope

rad.io supports four global user-managed receivers across the exclusive generator or as many as two concurrent hardware captures. A VFO has a session-stable ID, source-session ID, absolute RF frequency, mode, channel bandwidth, squelch threshold, DSP revision, label, gain, mute, and solo state.

Implemented demodulators:

| Mode | Default channel | Audio processing |
| --- | ---: | --- |
| WBFM | 200 kHz | automatic pilot-locked stereo, smooth mono blend, 15 kHz low-pass, DC block, 75 us per-channel de-emphasis |
| AM | 10 kHz | envelope detector, DC/carrier removal, 5 kHz low-pass, bounded attack/release gain |
| NBFM | 12.5 kHz | 2.5 kHz-deviation scaling, 3 kHz low-pass, DC block, 300 us de-emphasis |

SSB/CW, recording, output-device selection, spatial routing, and persisted presets are not implemented.

## Ownership

Continuous IQ branches to the VFO bank before FFT/display pacing. Generated IQ is processed in the DSP worker. Hardware IQ is canonicalized to signed bytes and processed by the shared `ExternalIqProcessor` inside the source acquisition worker. When WebUSB is unavailable in workers, the page owns only USB transport and display assembly while a processing-only worker retains VFO and RDS DSP. The active owner receives only DSP fields, while gain, mute, and solo remain in the AudioWorklet domain.

```text
source A continuous IQ -> shared-input Rust/WASM VFO bank A
       -> target NCO
       -> bounded CIC coarse decimation
       -> FIR channel filter and decimation
        -> WBFM stereo / AM / NBFM demodulator
       -> streaming resampler at AudioContext.sampleRate
       -> approximately 20 ms Float32 blocks
       -> source-keyed transferable MessagePort A --+
source B continuous IQ -> VFO bank B -> MessagePort B +-> AudioWorklet bounded queues
                                                        -> mixer -> AudioContext destination
```

The main thread attaches one fresh producer `MessagePort` for every running source that owns an in-band VFO. `AudioPlaybackController` keys attachment, flush, replacement, and detach messages by `sourceSessionId`; the worklet rejects a block whose VFO control belongs to another source. Audio blocks do not pass through React or the analyzer snapshot. The worklet control port carries global VFO gain/mute/solo/master updates and diagnostics sampled at four updates per second.

## WBFM Stereo

The WBFM discriminator runs at a source-derived narrowband rate: 250 kS/s for the current 2, 5, 10, and 20 MS/s source rates, and 300 kS/s for the supported 2.4 MS/s path. A narrow complex tracker recovers the 19 kHz pilot phasor and squares it to regenerate a coherent 38 kHz reference. Separate low-pass paths recover L+R and L-R before channel matrixing, 75 us de-emphasis, DC blocking, and paired resampling to the AudioContext rate.

Pilot strength drives an asymmetric smooth blend: stereo enters quickly on a usable pilot and returns more slowly to mono so fading does not hard-switch the soundstage. Lock indication uses separate acquire/release thresholds. Every WBFM block remains two-channel during fallback, with the mono sum duplicated to left and right, so queue framing never changes while receiving. `ST` means the current decoder revision is pilot-locked, `MONO` means a current block is using fallback, and `--` means no current status is available. This state is independent of the RDS stereo flag.

## Buffering And Mixing

The worklet prebuffers about 100 ms and caps each VFO near 250 ms. A smoothed queue-depth controller targets the midpoint and corrects each independently clocked VFO by at most $\pm0.5\%$. It normally consumes one source frame per output frame, occasionally consuming one extra or one fewer frame and linearly interpolating that render quantum. This asynchronous rate matching prevents hardware oscillator error from steadily draining or filling a queue without coupling separate SDR clocks. Overflow still drops oldest frames to bound latency. An initial start waits for the prebuffer; after playback has started, an underrun outputs silence but resumes on the next complete render quantum instead of imposing another 100 ms pause. Tune/mode revision changes, source removal, pause, reset, and discontinuities flush only the affected queues. Hardware retunes temporarily clear frequency-relative processing and restore current VFO routes after acknowledgement.

Enabled VFOs are summed with per-VFO dB gain. Mute removes one VFO. If any unmuted VFO is soloed, only unmuted solo VFOs are mixed. Master mute continues consuming queues. An immediate-attack, gradual-release limiter holds output below approximately -1 dBFS. AM and NBFM blocks are duplicated to both output channels; WBFM blocks contain interleaved `[L0, R0, L1, R1, ...]` frames.

## Lifecycle

Browser autoplay rules require the explicit Play action. That action creates or resumes one playback-latency `AudioContext`, loads the worklet, reads its negotiated sample rate, configures every running source bank that owns an in-band VFO, and transfers one producer port per such session. Live mixer and selected-view changes reuse the graph. Pause disables VFO processing on every attached producer, flushes the keyed queues, and suspends the context.

HackRF bulk input uses 256 KiB processing chunks and keeps approximately 50 ms of reads in flight: one at 2 MS/s, two at 5 MS/s, four at 10 MS/s, and eight at 20 MS/s. USB input therefore continues while the current chunk is demodulated. Development WASM uses optimized DSP codegen so its live processing behavior matches the release performance envelope while retaining debug information.

RTL-SDR keeps two 65,536-complex-sample reads queued. Unsigned bytes are converted in place before entering the same VFO processor. At 2.4 MS/s, each block spans about 27 ms and the two-read queue covers browser scheduling without creating an unbounded audio or display backlog.

VFO definitions are page-session state. They survive an owning source stop or retune but are removed with that hardware session and are not persisted across reload. A VFO whose channel plus filter transition touches or exceeds its source's Nyquist boundary is shown as out of band, omitted from that source's DSP configuration, and automatically reactivated when the capture covers it.

## Evidence And Limits

Rust regressions recover deterministic WBFM stereo, AM, and NBFM tones across irregular chunks, verify signed-byte WBFM input, exercise pilot phase/frequency error and hysteretic fallback, reject pilot aliases at the minimum output rate, and separate four simultaneous NBFM channels. Browser tests run each generated mode through the real AudioWorklet, observe WBFM lock, exercise four-VFO controls and queue diagnostics, and verify desktop/mobile layout.

A separate two-second signed-byte synthetic control was decoded through both the production `VfoBank` and an independent GNU Radio 3.10.12/SciPy 1.15.2 chain. The reference measured a 19,000.02 Hz pilot at 0.089 amplitude. Product/reference normalized correlations were 0.998 left and 0.995 right; correct channel pairing scored 0.997 versus 0.058 swapped, and L-R/L+R power differed by 0.30 dB. This proves the file paths and deterministic stereo regression, not over-the-air behavior.

On 2026-08-28, an eight-second receive-only HackRF capture of 97.3 MHz used a 97.05 MHz center, 2 MS/s sample rate, 1.75 MHz filter, LNA 16 dB, VGA 20 dB, RF amp off, and antenna bias off. The production decoder reported lock for 100% of 384,000 frames. The independent chain measured a 19,000.29 Hz pilot at 0.0877 amplitude; product/reference correlations were 0.981 left and 0.981 right, and L-R/L+R power differed by 0.43 dB. Correct pairing scored 0.981 versus 0.970 swapped. The program material was highly correlated at -21.6 dB L-R/L+R, so the capture strongly verifies pilot recovery and waveform agreement but provides only directional channel-order evidence.

Native and release-browser throughput are recorded in [Performance](performance.md). These tests prove deterministic DSP and browser integration. They are not independent live-RF proof. Hardware claims require bounded receive-only IQ capture and agreement with an independent demodulator as described by the repository hardware-verification workflow.

On 2026-09-01, the attached RTL2832U `0bda:2838` / Elonics E4000 produced an eight-second unsigned capture at 91.05 MHz center, 2.4 MS/s, and 42 dB tuner gain with bias power off. The production VFO bank processed all 19.2 million complex samples and reported stereo lock for 93.5% of 384,000 frames. The independent chain measured a 19,002.64 Hz pilot at 0.0803 amplitude and stereo-eligible content. Correct L/R pairing scored 0.654 versus 0.477 swapped and L-R/L+R differed by 0.56 dB, but per-channel correlations near 0.65 remain below the 0.80 parity threshold, plausibly influenced by a stronger adjacent 91.1 MHz station. Treat this as live acquisition, pilot, lock, and channel-order evidence, not complete waveform-parity proof.

On 2026-09-01, a headed physical browser run held a HackRF One at 2 MS/s and the attached RTL2832U/E4000 at 2.4 MS/s concurrently. Source-keyed WBFM VFOs at 100.3 MHz and 99.7 MHz both reported `playing` through a manual RTL retune from 100.0 to 99.8 MHz and a later optimizer retune to 99.65 MHz. Both per-session optimizers converged independently. RTL advanced from analyzer frame 1,548 before the manual retune to 5,136 afterward. A longer isolated control then exposed nominal-clock drift: RTL audio first underrun occurred after about 42 seconds while HackRF remained at zero for five minutes. After bounded per-queue rate matching was added, the same RTL path remained at zero underruns and zero overruns for five minutes. This proves live dual-source acquisition, retune route restoration, and the clock-matching failure boundary; it is not an independent fidelity comparison.

The final steady-state run used the same two radios, rates, receive-only safety settings, and one WBFM VFO per source for exactly 30 minutes. All 31 one-minute checkpoints reported both sessions `running`, both VFOs `playing`, and zero underruns and zero overruns. The selected analyzer advanced from frame 1,000 to 28,466. Chromium used-JS heap ranged from 41.4 MB to 68.0 MB and ended at 42.0 MB, 15.7 MB below its 57.6 MB baseline; the page long-task observer recorded zero entries. The final full-page screenshot is `test-results/hardware-verification/dual-sdr-30m-final.png`. This bounds the verified steady-state duration to 30 minutes and does not claim hours-long stability.

On 2026-08-28, a receive-only HackRF One (`2021.03.1`, API 1.04) soak used a 91.05 MHz center, a 91.3 MHz WBFM VFO, FFT 2,048, LNA 16 dB, VGA 20 dB, RF amp off, antenna bias off, and the attached station antenna. Baseband filters were 1.75, 3.5, 7, and 15 MHz at 2, 5, 10, and 20 MS/s respectively. Each rate ran for about 13 seconds across foreground, an eight-second minimized-window interval, and resumed playback. All twelve checkpoints reported zero AudioWorklet underruns and zero overruns while analyzer frames continued advancing. This verifies live acquisition and audio transport continuity; it is not an independent assessment of demodulated audio fidelity.
