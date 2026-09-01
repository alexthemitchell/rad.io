# Performance Baseline

This document separates implemented behavior, local measurements, inference, and future work. Results are not portable performance guarantees.

## Reproduce

```powershell
npm run benchmark:native
npm run benchmark:browser
```

`benchmark:native` runs the release-profile Rust harness in `crates/dsp-core/benches/pipeline_baseline.rs`. `benchmark:browser` builds release WASM, serves source modules through Vite, and runs `e2e/performance.spec.ts` with Playwright. The browser test attaches the full JSON result as `browser-performance.json`.

## Environment

Measured on 2026-08-28:

- Intel Core i7-14700K, 20 cores / 28 logical processors
- 64 GiB RAM
- Windows 11 Home 64-bit, build 10.0.26200
- Rust/Cargo 1.98.0
- Node.js 26.3.0, npm 11.16.0
- Playwright 1.62.1, bundled Chromium 151.0.7922.34
- browser reported 28 hardware threads and WebGPU API availability
- browser was not cross-origin isolated; SharedArrayBuffer was unavailable

The native harness measures one saturated thread. The browser harness uses release WASM but Vite-transformed TypeScript modules. Neither result includes live USB scheduling, RF converter behavior, or concurrent unrelated system load.

## Method

Native analyzer cases run for at least 350 ms after one warmup operation. RDS and VFO cases repeatedly process 32,768 complex signed-byte samples. Independent RDS channels instantiate the decoder directly beyond the production bank's four-target cap; those larger counts remain a scaling control rather than a user-facing VFO workload.

Browser worker cases reuse the returned external `ArrayBuffer`, warm up for five frames, and record 30 frames. `processing` is worker-reported WASM plus tracking/classification time. `frame round trip` is page-observed post-to-frame time and includes worker scheduling and transferable output delivery.

Browser RDS cases repeatedly pass the actual 16 KiB acquisition block to the WASM wrapper for 200 ms. This includes wasm-bindgen's JS-to-WASM slice copy. Native shared-bank and browser RDS cases call the bank directly; the application target selector remains capped at four targets for 2.4 MS/s, two for 10 MS/s, and one for 20 MS/s. Renderer cases use a 4096-bin frame, a 1200 CSS pixel canvas at 2x device pixel ratio, five warmups, 60 draws, and a final readback to flush Canvas2D work.

## Native Results

### Analyzer

| FFT size | Mean frame time | 30 FPS budget |
| ---: | ---: | ---: |
| 1,024 | 0.015 ms | 0.05% |
| 2,048 | 0.030 ms | 0.09% |
| 4,096 | 0.060 ms | 0.18% |
| 8,192 | 0.138 ms | 0.41% |
| 16,384 | 0.252 ms | 0.76% |

The analyzer consumes exactly one FFT-sized display block. Sample rate changes frequency scaling but not the amount of analyzer work per displayed frame.

### Independent Decoder Scaling Control

Real-time headroom is measured input throughput divided by source sample rate. Values below 1.0x miss continuous real time on this machine.

| Source rate | 1 target | 4 targets | 8 targets | 16 targets | 32 targets |
| ---: | ---: | ---: | ---: | ---: | ---: |
| 2.4 MS/s | 73.91x | 18.75x | 9.49x | 4.80x | 2.42x |
| 10 MS/s | 28.03x | 7.06x | 3.53x | 1.76x | 0.89x |
| 20 MS/s | 15.10x | 3.81x | 1.91x | 0.96x | 0.48x |

Observation: current direct per-target work crosses the deadline near 16 targets at 20 MS/s and near 32 targets at 10 MS/s.

Inference: a shared channelizer may become useful in that region. This RDS control is not a measured CPU/GPU or direct/PFB crossover; the implemented four-VFO filter/demodulation measurements are reported separately below.

### Shared Production RDS Bank

| Source rate | Targets | Throughput | Real-time headroom |
| ---: | ---: | ---: | ---: |
| 2.4 MS/s | 1 | 172.06 MS/s | 71.69x |
| 2.4 MS/s | 2 | 109.47 MS/s | 45.61x |
| 2.4 MS/s | 4 | 63.05 MS/s | 26.27x |
| 10 MS/s | 1 | 268.11 MS/s | 26.81x |
| 10 MS/s | 2 | 163.69 MS/s | 16.37x |
| 10 MS/s | 4 | 91.50 MS/s | 9.15x |
| 20 MS/s | 1 | 291.09 MS/s | 14.55x |
| 20 MS/s | 2 | 177.95 MS/s | 8.90x |
| 20 MS/s | 4 | 98.02 MS/s | 4.90x |

Measurement: at 20 MS/s and four targets, shared input traversal measured 98.02 MS/s versus 76.10 MS/s for the same-run independent control, a 28.8% throughput increase. Single-target throughput is about 3.6% lower because sharing has no duplicate work to amortize. Decoder state and metadata output match the independent path in deterministic tests.

### Multi-VFO Audio Bank

The VFO cases process 32,768 signed-byte complex samples and drain completed 20 ms audio blocks. WBFM automatically emits interleaved stereo; `4 mixed` uses one WBFM, one AM, and two NBFM receivers.

| Source rate | 1 WBFM stereo | 4 WBFM stereo | 4 mixed |
| ---: | ---: | ---: | ---: |
| 2.4 MS/s | 14.13x | 3.83x | 6.54x |
| 10 MS/s | 8.53x | 2.22x | 2.95x |
| 20 MS/s | 5.23x | 1.50x | 1.70x |

Measurement: direct filtered DDC remains above one real-time unit for all implemented four-VFO cases. Four WBFM stereo receivers at 20 MS/s are the current native worst case at 1.50x, so a PFB or GPU channelizer is not selected for this limit.

## Browser Results

### Release WASM Worker

| Source rate | FFT size | Mean processing | P95 processing | Mean frame round trip |
| ---: | ---: | ---: | ---: | ---: |
| 2.4 MS/s | 4,096 | 0.153 ms | 0.300 ms | 0.263 ms |
| 10 MS/s | 4,096 | 0.143 ms | 0.200 ms | 0.193 ms |
| 20 MS/s | 4,096 | 0.153 ms | 0.200 ms | 0.203 ms |

Observation: source sample rate does not materially change fixed-size display analysis. The measured transfer/scheduling remainder is below the browser clock's useful sub-millisecond resolution, so no separate copy-cost claim is made.

### Full-Rate RDS Including WASM Input Copy

| Source rate | 1 target | 2 targets | 4 targets |
| ---: | ---: | ---: | ---: |
| 2.4 MS/s | 60.52x | 38.96x | 21.08x |
| 10 MS/s | 20.90x | 12.73x | 7.08x |
| 20 MS/s | 11.26x | 6.86x | 3.75x |

Observation: the current 16 KiB wasm-bindgen copy does not threaten the four-target deadline on this machine. A persistent WASM input buffer or SharedArrayBuffer is therefore deferred.

### Multi-VFO Audio Including WASM Boundary

These release-browser cases include each 16 KiB JS-to-WASM input copy, completed audio-batch extraction, and per-VFO `Float32Array` mapping. Output accounting uses frames rather than scalar samples so stereo payloads are not double-counted. Empty transfers return without constructing a batch.

| Source rate | 1 WBFM stereo | 4 WBFM stereo | 4 mixed |
| ---: | ---: | ---: | ---: |
| 2.4 MS/s | 15.85x | 4.34x | 7.04x |
| 10 MS/s | 7.32x | 2.27x | 2.69x |
| 20 MS/s | 4.26x | 1.33x | 1.49x |

Observation: four WBFM stereo receivers at 20 MS/s are the browser worst case and retain 1.33x measured headroom. This is above continuous real time but close enough that live USB, concurrent RDS, background throttling, and long-session behavior remain explicit soak-test concerns. The mixed workload measured 1.49x at the same source rate.

### Canvas2D

| Renderer | Mean draw time |
| --- | ---: |
| Spectrum | 0.678 ms |
| Waterfall | 1.770 ms |
| Waveform, production 512 points | 3.395 ms |

The earlier 1,024-point production waveform measured 6.332 ms in the same setup. Reducing the preview to 512 points measured 3.395 ms, a 46.4% reduction in this local experiment. Spectrum resolution remains 4,096 bins.

## Decisions

Implemented:

- shared input traversal for the RDS bank
- representative 2.4 MS/s RDS support
- RTL2832U/E4000 WebUSB acquisition with one in-place U8-to-I8 conversion
- two simultaneous source sessions with one worker/controller stack per hardware clock
- source-keyed AudioWorklet fan-in with bounded asynchronous queue rate matching
- 512-point waveform previews
- reproducible native and release-browser benchmarks
- direct filtered VFO DDC/demodulation and native/browser one/four-receiver benchmarks

Rejected for now:

- WebGPU FFT/rendering because no implemented CPU path approaches its deadline
- SharedArrayBuffer because transfer/copy costs are below the useful optimization threshold and the app is not cross-origin isolated
- a polyphase/FFT channelizer because the implemented four-VFO workload remains above real time
- per-VFO wideband FFTs because they duplicate source-wide work by construction

## Unknowns And Future Measurements

Not measured:

- sustained browser CPU utilization, memory growth, and garbage-collection pauses over hours
- real HackRF dropped USB transfers or display blocks at 10/20 MS/s
- RTL-SDR USB/display/audio queue and heap behavior beyond 30 minutes
- end-to-end source-to-speaker latency
- concurrent live HackRF RDS plus four-WBFM soak behavior at 20 MS/s
- WebGPU crossover, numerical parity, transfer cost, or device-loss behavior

On 2026-09-01, headed Playwright MCP runs used the attached RTL2832U/E4000 at 2.4 MS/s alone and concurrently with a HackRF One at 2 MS/s. The dual product kept both analyzers and source-keyed WBFM VFOs live through RTL retunes and independent optimization. A five-minute steady-state control exposed 29 underruns before clock matching; isolation reproduced the first RTL underrun after about 42 seconds while HackRF alone remained at zero for five minutes. Bounded per-queue rate matching then held the same isolated RTL path at zero underruns and zero overruns for five minutes.

The final untouched dual-source run lasted exactly 30 minutes with one WBFM VFO per radio. All 31 one-minute checkpoints reported both sessions running, both VFOs playing, and zero AudioWorklet underruns and overruns. The selected analyzer advanced from frame 1,000 to 28,466. Used JS heap ranged 41.4-68.0 MB and ended at 42.0 MB, 15.7 MB below the 57.6 MB baseline; a page `PerformanceObserver` recorded zero long tasks. These runs prove live WebUSB transport, source isolation, corrected queue drift, and bounded 30-minute heap/audio stability, not hours-long stability or independent audio fidelity.

The next high-information experiment is an hours-long concurrent HackRF plus RTL soak with heap, queue-depth, and underrun/overrun sampling, followed by higher-rate multi-VFO hardware workloads. Keep one worker stack per independent sample clock and a global four-VFO budget. Reconsider shared memory or a channelizer only if that measured workload misses real time; do not infer hardware behavior from synthetic input.
