# Signal Analyzer Architecture

## Data Flow

```text
Generated mode
React controls -> AnalyzerController -> dedicated worker -> Rust/WASM generator
                                                     -> Rust/WASM FFT
                                                     -> spectral detector
                                                     -> signal tracker + classifier
                                                     -> transferable frame
                                                     -> FrameHub (rAF)
                                                     -> Canvas2D renderers

External mode
Window permission -> acquisition worker -> signed int8 HackRF IQ
                           -> latest complete FFT block -> interleaved Float32 IQ
                           -> AnalyzerSource -> DSP worker -> same Rust/WASM FFT
                                  ^       buffer returned <- input-released <---+
```

`AnalyzerController` initializes one `DspWorkerClient` for its lifetime. React receives worker state changes immediately and samples numeric status every 250 ms. Spectrum, waterfall, and waveform arrays go directly from `FrameHub` to renderer objects without a React render.

## Rust Crates

- `crates/dsp-core` is browser-independent DSP. It contains configuration validation, the continuous-phase complex tone generator, seeded Gaussian noise, Hann windowing, shifted FFT analysis, dBFS normalization, multi-signal spectral detection, and waveform decimation.
- `crates/dsp-wasm` is a thin `wasm-bindgen` boundary. It exposes a stateful `DspEngine` and typed-array frame getters.

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

Worker messages carry `protocolVersion: 2`. The main request types are:

- `init`, `configure`, `configure-detection`, `start-generated`, `stop`, and `reset`
- `frame-consumed` for display delivery acknowledgment
- `process-samples` for externally acquired IQ

The worker emits `ready`, `configured`, `detection-configured`, `status`, `analysis-frame`, `input-released`, and structured `error` messages. It verifies that the loaded WASM engine reports the same protocol version before accepting work. Analysis frames preserve the external source sequence, timestamp, and sample-format version for discontinuity detection. External IQ remains sample format version 1 because its interleaved layout did not change.

Generated mode permits one analysis frame awaiting `frame-consumed`. The next frame is scheduled only after render delivery, so a slow tab cannot build an unbounded queue. External input is rejected with `dropped: true` while generated mode or an unconsumed frame owns the processor. All large arrays use transfer lists instead of structured-clone copies.

## Rendering

Each visualization implements the same `CanvasRenderer` contract:

- `resize(width, height, pixelRatio)`
- `draw(frame)`
- `reset()`

`ResizeObserver` and a capped device-pixel ratio keep the plots sharp without changing layout dimensions. The waterfall keeps image history in a private offscreen canvas and reuses the spectrum row already produced for the line plot.

This contract leaves room for WebGL or OffscreenCanvas renderers without changing the React controls or worker protocol.

## HackRF WebUSB Source

`HackRFSource` implements `AnalyzerSource` from `src/sources/types.ts`. The window first checks `navigator.usb.getDevices()` for an origin-authorized HackRF. Only an initial or revoked pairing calls `navigator.usb.requestDevice()` from the Connect action, where transient user activation is available. The acquisition worker finds that authorized device with its own `navigator.usb.getDevices()`, claims the vendor interface, and owns the receive loop. Chromium versions that expose WebUSB only on the window use the same browser transport on the main thread; there is no native fallback.

The source opens HackRF One `1d50:6089`, discovers its vendor-specific bulk-IN endpoint from USB descriptors, and configures receive mode with device-recipient vendor requests. Startup forces transceiver, antenna bias, and RF amplifier off before applying sample rate, baseband filter, center frequency, LNA/VGA gains, and RX mode. Samples arrive as signed interleaved bytes:

```text
[I0_i8, Q0_i8, I1_i8, Q1_i8, ...]
```

Each value is divided by 128 into the analyzer's interleaved `Float32` contract. The source continuously drains sequential 16 KiB bulk transfers so browser rendering cannot back up the radio. It assembles exact FFT blocks, retains only the newest eligible block, and submits at most one block every `sampleRate / frameRate` samples. While DSP owns the sole transferable output buffer, USB reads continue and older display blocks are discarded by advancing the source sequence.

The returned `input-released` buffer is transferred back to the acquisition worker and reused. A stalled bulk endpoint receives bounded `clearHalt` recovery. Stop switches the transceiver off, aborts the pending read by closing when necessary, releases the claimed interface, and closes the device.

WebUSB requires a secure context in production. SharedArrayBuffer and cross-origin isolation are deliberately deferred; transferable buffers are the measured baseline.

The implementation is OS-neutral and has no dependency on `libhackrf`, Node `usb`, native bridges, browser extensions, custom driver installers, or firmware changes. The host still controls whether Chromium can claim a USB interface. Windows can use its inbox WinUSB service through HackRF's Microsoft compatible-ID descriptor; some Linux installations deny raw USB device-node access through host policy. The page detects and reports those failures but cannot bypass them from the browser sandbox.

## Performance Invariants

- No React state update occurs per IQ packet or rendered frame.
- HackRF USB reads run independently of React and retain at most one pending display block.
- Only one generated analysis frame can be in flight.
- Canvas dimensions are stable and responsive.
- Worker creation is isolated from live control dependencies.
- Configuration changes rebuild cached FFT state atomically.
- External sources receive ownership of their input buffer back.
