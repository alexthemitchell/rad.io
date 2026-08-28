# Signal Analyzer Architecture

## Current Scope

Implemented today:

- one active generated or HackRF wideband source
- one paced wideband spectrum/detection lane
- up to four continuous, independently tuned FM/RDS decoder targets
- CPU DSP in browser-independent Rust, compiled to WASM for the browser
- dedicated acquisition and DSP workers, transferable display buffers, and Canvas2D rendering

Not implemented today:

- an RTL-SDR browser source adapter
- a generic user-facing VFO bank or audio demodulators
- AudioWorklet output or multi-VFO audio mixing
- WebGPU/WebGL compute or rendering
- simultaneous independent source sessions in the UI

The architecture decisions below preserve those paths without claiming that roadmap work is already present. Measured costs and limitations are recorded in [Performance](performance.md).

## Data Flow

```text
Generated mode
React controls -> AnalyzerController -> dedicated worker -> Rust/WASM generator
                                                     -> streaming RDS decoder
                                                     -> Rust/WASM FFT
                                                     -> spectral detector
                                                     -> signal tracker + classifier
                                                     -> transferable frame
                                                     -> FrameHub (rAF)
                                                     -> Canvas2D renderers

External mode
Window permission -> acquisition worker -> signed int8 HackRF IQ
                           -> shared-input Rust/WASM RDS bank -> per-target DDC/demodulation
                                                                  -> metadata events
                           -> latest complete FFT block -> interleaved Float32 IQ
                           -> AnalyzerSource -> DSP worker -> same Rust/WASM FFT
                                  ^       buffer returned <- input-released <---+
```

`AnalyzerController` initializes one `DspWorkerClient` for its lifetime. React receives worker state changes immediately and samples numeric status every 250 ms. Spectrum, waterfall, and waveform arrays go directly from `FrameHub` to renderer objects without a React render.

The display and continuous-decoder lanes intentionally split in the acquisition owner. Display backpressure can discard old FFT blocks without interrupting full-rate RDS continuity. The RDS bank traverses each incoming block once, normalizes and timestamps each sample once, then fans it out to independent target state. Frequency translation and demodulation remain target-specific.

## Ownership And Copies

| Stage | Owner and memory | Copy or synchronization |
| --- | --- | --- |
| USB bulk-IN | Browser-owned `ArrayBuffer` in the acquisition owner | Sequential `transferIn`; `Int8Array` is a view |
| Live RDS input | Acquisition worker JS to acquisition worker WASM | One wasm-bindgen slice copy, then one shared i8-to-complex conversion per 16 KiB transfer |
| Display assembly | Persistent signed-byte FFT block in `HackRfIqBlockAssembler` | One bounded `TypedArray.set` copy; old display blocks may be overwritten |
| Display normalization | Sole reusable `Float32Array` output buffer | One i8-to-f32 conversion pass |
| Acquisition to main to DSP worker | Same transferred `ArrayBuffer` | Two ownership transfers and message scheduling; no payload clone |
| Analyzer input | DSP worker JS to DSP WASM | One wasm-bindgen f32 slice copy per displayed frame |
| Analyzer output | WASM `Vec` getters to JS typed arrays | Waveform and spectrum are cloned out of WASM once per displayed frame |
| DSP worker to renderers | Transferable waveform and spectrum buffers | Ownership transfer, then one pending `requestAnimationFrame` delivery |
| Canvas2D | Main-thread browser canvas resources | CPU path construction and canvas upload; no GPU-resident DSP data |

There is no sample-by-sample JavaScript callback. All hot paths are block oriented and all queues are bounded. SharedArrayBuffer would remove only some of the listed copies while adding cross-origin isolation and atomic ring-buffer lifecycle requirements; current measurements do not justify it.

## Rust Crates

- `crates/dsp-core` is browser-independent DSP. It contains configuration validation, deterministic tone and FM+RDS generation, Hann windowing, shifted FFT analysis, spectral detection, and stateful RDS block/group decoding.
- `crates/dsp-wasm` is a thin `wasm-bindgen` boundary. It exposes the analyzer `DspEngine`, a standalone `RdsDecoderBank`, typed-array frame getters, and structured metadata snapshots.

`rustfft` plans and Hann coefficients are created when the analyzer configuration changes, not for every frame.

## Sample Contract

External IQ uses an interleaved `Float32Array`:

```text
[I0, Q0, I1, Q1, I2, Q2, ...]
```

A `SampleChunk` carries:

- `formatVersion: 1`
- sample rate in hertz
- center frequency in hertz
- source sequence number
- monotonic source timestamp in microseconds
- the transferable IQ array

The current analyzer expects exactly one configured FFT block per chunk. A hardware adapter should accumulate USB transfers into complete blocks before calling the sink. `AnalyzerController.ingest` returns the transferred buffer and a dropped flag so the source can maintain a fixed buffer pool.

## Spectrum Scaling

The FFT input is multiplied by a symmetric Hann window. Magnitude is divided by the sum of the window coefficients, so a bin-centered complex tone with amplitude $A$ is displayed as:

```text
dBFS = 20 log10(A)
```

Output bins are shifted into `[-sampleRate/2, +sampleRate/2)`. Values below -120 dBFS are clamped to the display floor. Levels are relative digital measurements, not calibrated RF power or dBm.

## Protocol And Backpressure

Worker messages carry `protocolVersion: 3`. The main request types are:

- `init`, `configure`, `configure-detection`, `start-generated`, `stop`, and `reset`
- `frame-consumed` for display delivery acknowledgment
- `process-samples` for externally acquired IQ

The worker emits `ready`, `configured`, `detection-configured`, `status`, `analysis-frame`, `input-released`, and structured `error` messages. It verifies that the loaded WASM engine reports the same protocol version before accepting work. Analysis frames include up to four RDS targets selected by stable FM channel center and preserve the external source sequence, timestamp, and sample-format version. External IQ remains sample format version 1 because its interleaved layout did not change.

Generated mode permits one analysis frame awaiting `frame-consumed`. The next frame is scheduled only after render delivery, so a slow tab cannot build an unbounded queue. External input is rejected with `dropped: true` while generated mode or an unconsumed frame owns the processor. All large arrays use transfer lists instead of structured-clone copies.

## Rendering

Each visualization implements the same `CanvasRenderer` contract:

- `resize(width, height, pixelRatio)`
- `draw(frame)`
- `reset()`

`ResizeObserver` and a capped device-pixel ratio keep the plots sharp without changing layout dimensions. The waterfall keeps image history in a private offscreen canvas and reuses the spectrum row already produced for the line plot.

The waveform preview is bounded to 512 complex points independently of FFT size. This reduces WASM output, worker transfer size, and measured Canvas2D path cost without changing spectrum resolution.

This contract leaves room for WebGL or OffscreenCanvas renderers without changing the React controls or worker protocol.

## HackRF WebUSB Source

`HackRFSource` implements `AnalyzerSource` from `src/sources/types.ts`. The window first checks `navigator.usb.getDevices()` for an origin-authorized HackRF. Only an initial or revoked pairing calls `navigator.usb.requestDevice()` from the Connect action, where transient user activation is available. The acquisition worker finds that authorized device with its own `navigator.usb.getDevices()`, claims the vendor interface, and owns the receive loop. Chromium versions that expose WebUSB only on the window use the same browser transport on the main thread; there is no native fallback.

The source opens HackRF One `1d50:6089`, discovers its vendor-specific bulk-IN endpoint from USB descriptors, and configures receive mode with device-recipient vendor requests. Startup forces transceiver, antenna bias, and RF amplifier off before applying sample rate, baseband filter, center frequency, LNA/VGA gains, and RX mode. Samples arrive as signed interleaved bytes:

```text
[I0_i8, Q0_i8, I1_i8, Q1_i8, ...]
```

Each value is divided by 128 into the analyzer's interleaved `Float32` contract. The source continuously drains sequential 16 KiB bulk transfers so browser rendering cannot back up the radio. It assembles exact FFT blocks, retains only the newest eligible block, and submits at most one block every `sampleRate / frameRate` samples. While DSP owns the sole transferable output buffer, USB reads continue and older display blocks are discarded by advancing the source sequence.

RDS decoding branches before that display throttle. Every successful signed 8-bit transfer is synchronously fed to a standalone WASM decoder bank in the acquisition worker. Input validation, i8 normalization, and timestamp calculation are shared across targets; frequency translation and decoder state remain independent. The main DSP worker sends target changes only when the selected FM channel set changes, and the acquisition worker coalesces metadata updates to at most four per second. Chromium configurations that require the page-thread WebUSB fallback use the same decoder and update contract. A transfer stall or retry resets symbol synchronization instead of joining discontinuous samples.

The returned `input-released` buffer is transferred back to the acquisition worker and reused. A stalled bulk endpoint receives bounded `clearHalt` recovery. Stop switches the transceiver off, aborts the pending read by closing when necessary, releases the claimed interface, and closes the device.

WebUSB requires a secure context in production. SharedArrayBuffer and cross-origin isolation are deliberately deferred; transferable buffers are the measured baseline.

The implementation is OS-neutral and has no dependency on `libhackrf`, Node `usb`, native bridges, browser extensions, custom driver installers, or firmware changes. The host still controls whether Chromium can claim a USB interface. Windows can use its inbox WinUSB service through HackRF's Microsoft compatible-ID descriptor; some Linux installations deny raw USB device-node access through host policy. The page detects and reports those failures but cannot bypass them from the browser sandbox.

## Performance Invariants

- No React state update occurs per IQ packet or rendered frame.
- HackRF USB reads run independently of React and retain at most one pending display block.
- Full-rate RDS IQ stays in the acquisition owner; only low-rate metadata crosses worker boundaries.
- RDS state is bounded to four channel-centered decoders and bounded raw-group histories.
- Only one generated analysis frame can be in flight.
- Canvas dimensions are stable and responsive.
- Worker creation is isolated from live control dependencies.
- Configuration changes rebuild cached FFT state atomically.
- External sources receive ownership of their input buffer back.

## VFO Evolution

The current RDS targets are the repository's only continuous multi-channel workload. They are useful evidence for VFO scaling, but they are not presented as general VFOs: they have a fixed FM/RDS pipeline, emit metadata rather than audio, and are capped at four targets.

The next user-facing VFO implementation should remain source-owned and branch before display throttling:

```text
SourceSession
  -> continuous wideband IQ
         -> display sampler -> analyzer worker -> renderers
         -> CPU VFO bank
                -> direct DDC + decimation per active VFO
                -> mode-specific demodulator
                -> bounded audio blocks
                -> AudioWorklet mixer/output
```

Start with direct CPU/WASM DDC for a small VFO count. Keep the bank contract block-oriented and backend-neutral so a polyphase or GPU channelizer can replace only the extraction stage. Do not perform one wideband FFT, detector, or source conversion independently per VFO.

A channelizer is justified only after representative demodulators and bandwidths exist and the VFO benchmark reaches its deadline. The current RDS proxy reaches approximately one real-time unit at 16 targets for 20 MS/s and at 32 targets for 10 MS/s on the measured machine. Those are experiment thresholds, not product limits or proof of a PFB crossover.

Audio is a separate real-time domain. When added, the AudioWorklet should consume bounded narrowband audio blocks and mix only enabled audio VFOs. UI rendering and React state must not participate in its callback. SharedArrayBuffer can be evaluated for that ring only when cross-origin isolation deployment is acceptable; a transferable `MessagePort` queue is the simpler fallback.

## Multiple Sources

`AnalyzerSource` is already an instance interface, but the current `AnalyzerController` and UI own one active source. Multiple devices should be modeled as multiple `SourceSession` instances, each with its own acquisition owner, center frequency, wideband processor, VFO bank, backpressure, and failure lifecycle. IQ from independent clocks must not be merged into one channelizer unless coherent sampling is an explicit future feature.

An RTL-SDR adapter can implement `AnalyzerSource` without changing analyzer or renderer contracts. The Rust RDS front end now accepts the representative 2.4 MS/s rate; browser USB commands and RTL sample-format conversion remain unimplemented device-specific work.

## CPU And GPU Boundary

There is no WebGPU path. CPU/WASM remains the selected backend because release-browser 4096-bin analysis and transfer are far below the frame budget, Canvas2D spectrum/waterfall rendering is also below budget, and four-target continuous RDS retains real-time headroom at 20 MS/s. GPU dispatch, upload, device-loss handling, and readback would currently cost complexity without addressing a measured bottleneck.

WebGPU should be reconsidered when at least one of these is measured:

- a batched full-rate FFT or channel bank misses its deadline
- many active VFOs push direct CPU DDC near one real-time unit
- spectrum/waterfall intermediates can remain GPU-resident through rendering

The first GPU experiment must compare end-to-end latency and transfers against the CPU implementation. Any GPU backend must tolerate unavailable WebGPU and device loss by returning to CPU/WASM. Stateful low-rate demodulation and audio remain CPU candidates unless a separate measurement says otherwise.

## Decision Records

### Transferables Before Shared Memory

- Problem: move display IQ and frames across workers without an unbounded queue.
- Current cost: two ownership handoffs plus one WASM input copy for each paced display frame.
- Alternatives: structured clone, SharedArrayBuffer ring, processing all DSP in the acquisition worker.
- Expected benefit: SharedArrayBuffer could remove handoff latency and one pool lifecycle at high block rates.
- Complexity cost: cross-origin isolation, Atomics, wraparound, shutdown, overflow, and browser fallback behavior.
- Evidence: a 4096-bin release-browser round trip measures about 0.20 ms and the source retains only one display block.
- Decision: keep transfer-and-return ownership.
- Confidence: high for the current display lane.
- Reversal cost: moderate; the source and worker protocol already isolate transport details.

### Shared CPU Traversal Before A Channelizer

- Problem: every RDS target repeated wideband i8 conversion, validation, and timestamp calculation.
- Current cost: target-linear DDC/demodulation remains, but input preparation is now shared.
- Alternatives: independent loops, shared traversal, CPU polyphase bank, GPU channelizer.
- Expected benefit: reduce duplicated wideband work at negligible architectural cost.
- Complexity cost: one bank-level traversal while decoder state remains independent.
- Evidence: the native four-target 20 MS/s control measured 76.1 MS/s versus 98.0 MS/s for the shared bank, with deterministic state/output equivalence tests.
- Decision: keep shared traversal; defer PFB/GPU channelization.
- Confidence: high for up to four current targets, medium for future demodulator workloads.
- Reversal cost: low; public decoder and WASM APIs did not change.

### CPU/WASM Before WebGPU

- Problem: choose an execution domain for FFT, channel extraction, and visualization.
- Current cost: approximately 0.15 ms worker processing for a 4096-bin release frame and about 3.8x browser headroom for four RDS targets at 20 MS/s on the measured machine.
- Alternatives: WASM, WebGPU compute, hybrid compute/rendering.
- Expected benefit: WebGPU could win for batched FFT filter banks or GPU-resident waterfall data.
- Complexity cost: shader implementations, upload/dispatch synchronization, numerical parity, device loss, and CPU readback.
- Evidence: no measured CPU deadline is close in the implemented workload.
- Decision: retain CPU/WASM and Canvas2D; keep WebGPU optional and unimplemented.
- Confidence: high for current workloads, low beyond the measured VFO proxy.
- Reversal cost: low if future channel extraction is kept behind the source-owned VFO bank boundary.
