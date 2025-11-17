# ADR-0027: DSP Pipeline Architecture with Workers, SharedArrayBuffer, and WASM

## Status

Accepted

## Context

rad.io processes real-time radio frequency (RF) data streams at high sample rates (2.4-20 MSPS) requiring intensive digital signal processing. The application must:

1. **Maintain UI responsiveness** while processing continuous data streams
2. **Achieve low latency** (< 50ms end-to-end for demodulation)
3. **Sustain high throughput** (2.4+ MSPS continuous processing)
4. **Prevent buffer drops** during heavy processing load
5. **Provide real-time visualization** (30-60 FPS waterfall/spectrum)
6. **Handle backpressure** when consumers can't keep up with producers

### Current State

The application has established foundations:

- Web Worker pool for parallel DSP (ADR-0002, ADR-0012)
- SharedRingBuffer implementation with Atomics for lock-free data transfer
- AssemblyScript/WASM DSP primitives (FFT, windowing, filters)
- HTTPS dev server (required for SharedArrayBuffer)

However, the **complete pipeline architecture** is not formally documented, leading to:

- **Unclear data flow** between producers, buffers, DSP stages, and consumers
- **Missing backpressure mechanisms** causing potential buffer overruns
- **No comprehensive metrics** for monitoring pipeline health
- **Unverified WASM coverage** for performance-critical operations
- **No SharedArrayBuffer enablement** in production (COOP/COEP headers required)

### Problem Statement

Without a clear, documented DSP pipeline architecture:

- Engineers cannot reason about data flow and threading boundaries
- Performance bottlenecks are difficult to diagnose
- Buffer management strategies are ad-hoc and inconsistent
- Dropped samples and stalls occur without visibility
- WASM optimization opportunities are unclear

## Decision

Implement a **unified DSP pipeline architecture** with explicit boundaries:

```
┌─────────────────────────────────────────────────────────────────────┐
│                           MAIN THREAD                               │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  Producer (SDR Device via WebUSB)                                  │
│    │                                                               │
│    ├─ Sample acquisition (IQ data from hardware)                  │
│    └─ Write to SharedRingBuffer (zero-copy via SAB)               │
│         │                                                          │
│         ▼                                                          │
│  ┌──────────────────────────────────────────┐                     │
│  │   SharedRingBuffer (SharedArrayBuffer)    │                     │
│  │   - Lock-free ring buffer with Atomics   │                     │
│  │   - Backpressure via available space     │                     │
│  │   - Producer/consumer coordination       │                     │
│  └──────────────────────────────────────────┘                     │
│         │                                                          │
└─────────┼──────────────────────────────────────────────────────────┘
          │
          ▼ (zero-copy read via SAB)
┌─────────────────────────────────────────────────────────────────────┐
│                      DSP WORKER POOL                                │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  Stage 1: Pre-processing (WASM)                                    │
│    ├─ DC offset correction (IIR filter)                           │
│    ├─ Windowing (Hann, Hamming, Blackman)                         │
│    └─ AGC (automatic gain control)                                │
│         │                                                          │
│         ▼                                                          │
│  Stage 2: Frequency Analysis (WASM)                                │
│    ├─ FFT computation (radix-2, SIMD-optimized)                   │
│    ├─ Power spectrum calculation                                  │
│    └─ Peak detection                                              │
│         │                                                          │
│         ▼                                                          │
│  Stage 3: Demodulation (WASM/JS)                                   │
│    ├─ AM/FM/SSB/Digital mode demodulation                         │
│    ├─ Symbol timing recovery                                      │
│    ├─ Carrier recovery (PLL, Costas loop)                         │
│    └─ Filtering and decimation                                    │
│         │                                                          │
└─────────┼──────────────────────────────────────────────────────────┘
          │
          ▼ (transferable ArrayBuffer)
┌─────────────────────────────────────────────────────────────────────┐
│                           MAIN THREAD                               │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  Consumer 1: Audio Output (Web Audio API)                          │
│    ├─ Audio graph processing                                      │
│    ├─ Volume control, muting                                      │
│    └─ Speaker/recording output                                    │
│                                                                     │
│  Consumer 2: Visualization (Canvas/WebGL)                          │
│    ├─ Waterfall rendering (30-60 FPS target)                      │
│    ├─ Spectrum analyzer display                                   │
│    ├─ Constellation diagram                                       │
│    └─ Signal strength indicators                                  │
│                                                                     │
│  Consumer 3: Analysis/Metrics                                      │
│    ├─ SNR calculation                                             │
│    ├─ BER/MER measurement                                         │
│    └─ Signal classification                                       │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### Key Architectural Decisions

#### 1. SharedArrayBuffer for Zero-Copy Transfer

**Decision:** Use SharedArrayBuffer-backed ring buffers for producer→worker data transfer.

**Rationale:**

- **10+ GB/s throughput** vs 200 MB/s with postMessage
- **< 0.1ms latency** vs 1-5ms with postMessage
- **Zero-copy semantics** eliminates GC pressure from buffer allocation
- **Lock-free operations** via Atomics for thread safety

**Requirements:**

- COOP: `Cross-Origin-Opener-Policy: same-origin`
- COEP: `Cross-Origin-Embedder-Policy: require-corp`
- HTTPS (already required for WebUSB)

#### 2. Worker Pool for Parallel DSP

**Decision:** 2-4 workers based on `navigator.hardwareConcurrency`.

**Rationale:**

- True parallelism on multi-core CPUs
- Isolation prevents DSP crashes from affecting UI
- Round-robin scheduling distributes load
- Priority queuing for time-sensitive operations

**Pool Size Strategy:**

```typescript
const poolSize = Math.min(4, Math.max(2, navigator.hardwareConcurrency || 2));
```

#### 3. WASM for Performance-Critical Operations

**Decision:** AssemblyScript/WASM for hot paths with JavaScript fallback.

**Coverage:**

- ✅ **FFT/IFFT** (radix-2, SIMD-optimized): 4x speedup
- ✅ **Window functions** (Hann, Hamming, Blackman): 4x speedup
- ✅ **DC offset correction** (static, IIR): 2.5-3x speedup
- ✅ **FIR filtering**: 3x speedup
- ⚠️ **Demodulation cores**: Partially covered (AM/FM in JS, consider porting)
- ⚠️ **Resampling**: Not yet WASM-accelerated

**Benchmark Results:**

| Operation   | Size         | JS Performance | WASM Performance | Speedup |
| ----------- | ------------ | -------------- | ---------------- | ------- |
| FFT         | 2048 pts     | ~2ms           | ~0.5ms           | 4x      |
| FFT         | 8192 pts     | ~8ms           | ~2ms             | 4x      |
| DC Static   | 1024 samples | ~0.3ms         | ~0.1ms           | 3x      |
| DC IIR      | 1024 samples | ~0.5ms         | ~0.2ms           | 2.5x    |
| Hann Window | 1024 samples | ~0.2ms         | ~0.05ms          | 4x      |

**Future WASM Candidates:**

- **Resampling** (rational/polyphase filters): High CPU usage in JS
- **AM/FM demodulation**: Simple algorithms, SIMD-friendly
- **Adaptive equalizers**: Matrix operations benefit from SIMD

#### 4. Backpressure Handling

**Decision:** Multi-level backpressure strategy.

**Mechanisms:**

**Level 1: Ring Buffer Space Monitoring**

```typescript
// Producer checks available space before writing
const availableSpace = ringBuffer.getAvailableSpace();
if (availableSpace < requiredSize) {
  // Apply backpressure: slow down acquisition or drop oldest
  handleBackpressure(BackpressureStrategy.SLOW_DOWN);
}
```

**Level 2: Worker Queue Depth Monitoring**

```typescript
// Track pending DSP tasks
const queueDepth = dspWorkerPool.getPendingTaskCount();
if (queueDepth > MAX_QUEUE_DEPTH) {
  // Skip non-critical processing (e.g., waterfall frames)
  skipVisualizationFrame();
}
```

**Level 3: Consumer Rate Limiting**

```typescript
// Visualization frame rate limiting
const targetFPS = 60;
const minFrameTime = 1000 / targetFPS;
if (now - lastFrameTime < minFrameTime) {
  // Skip frame to maintain target FPS
  return;
}
```

**Metrics:**

- Ring buffer utilization percentage
- Worker queue depth
- Dropped sample count
- Processing latency (P50, P95, P99)

#### 5. Error Handling and Recovery

**Decision:** Graceful degradation with error recovery.

**Error Categories:**

**Worker Errors:**

- **Detection:** Worker `onerror` event
- **Recovery:** Restart failed worker, requeue task
- **Fallback:** Process in main thread (degraded performance)

**Buffer Overruns:**

- **Detection:** Ring buffer write fails (no space)
- **Recovery:** Drop oldest samples, emit warning
- **Metrics:** Track drop rate, alert if > 1%

**WASM Failures:**

- **Detection:** WASM module load failure or runtime exception
- **Recovery:** Fall back to JavaScript implementation
- **Warning:** Notify user of degraded performance

**SharedArrayBuffer Unavailable:**

- **Detection:** `canUseSharedArrayBuffer()` returns false
- **Recovery:** Fall back to transferable ArrayBuffer (higher overhead)
- **Warning:** Inform user to enable COOP/COEP headers

#### 6. Performance Monitoring

**Decision:** Comprehensive metrics at each pipeline stage.

**Metrics Collection:**

```typescript
interface PipelineMetrics {
  // Producer metrics
  producer: {
    samplesPerSecond: number;
    bufferUtilization: number; // 0-1
    droppedSamples: number;
  };

  // DSP worker metrics
  dsp: {
    avgProcessingTime: number;
    maxProcessingTime: number;
    queueDepth: number;
    workerUtilization: number[]; // per-worker
  };

  // Consumer metrics
  audio: {
    bufferUnderruns: number;
    latency: number;
  };
  visualization: {
    actualFPS: number;
    droppedFrames: number;
  };
}
```

**Monitoring Dashboard:**

- Real-time metrics display in diagnostics panel
- Performance warnings when thresholds exceeded
- Historical trend graphs for debugging

## Consequences

### Positive

✅ **Clear architecture**: Engineers can reason about data flow and threading  
✅ **Zero-copy performance**: SharedArrayBuffer eliminates transfer overhead  
✅ **Backpressure handling**: Prevents buffer overruns and dropped samples  
✅ **Comprehensive metrics**: Visibility into pipeline performance  
✅ **Graceful degradation**: Falls back when advanced features unavailable  
✅ **WASM acceleration**: 2-4x speedup for hot paths  
✅ **Scalability**: Worker pool adapts to available CPU cores  
✅ **Resilience**: Error recovery prevents catastrophic failures

### Negative

❌ **Complexity**: More moving parts than single-threaded approach  
❌ **Deployment requirements**: COOP/COEP headers required for SAB  
❌ **Browser compatibility**: SharedArrayBuffer disabled on some browsers  
❌ **Debugging difficulty**: Multi-threaded debugging more challenging  
❌ **Memory overhead**: Multiple worker contexts consume RAM

### Neutral

⚪ **WASM build complexity**: AssemblyScript toolchain required  
⚪ **Fallback paths**: Must maintain both WASM and JS implementations  
⚪ **Testing complexity**: Must test both SAB and non-SAB paths

## Performance Targets

### Throughput

- **2.4 MSPS sustained**: HackRF One standard sample rate
- **20 MSPS peak**: For wideband SDRs (Airspy, LimeSDR)
- **< 1% drop rate**: Under normal operating conditions

### Latency

- **< 50ms end-to-end**: For demodulation (PRD requirement)
- **< 10ms DSP processing**: FFT, filtering, demod combined
- **< 0.1ms transfer overhead**: SharedArrayBuffer ring buffer

### Visualization

- **30 FPS minimum**: Waterfall at 2048 FFT size
- **60 FPS target**: Waterfall at 1024 FFT size
- **Stable frame rate**: < 5% frame drops over 1-hour session

### Resource Utilization

- **75-85% CPU**: Multi-device monitoring
- **< 500 MB RAM**: Typical single-device operation
- **< 2 GB RAM**: Multi-device with recordings

## Acceptance Criteria

1. ✅ **ADR document created** and merged
2. ✅ **COOP/COEP headers configured** in webpack-dev-server and production
3. ⬜ **SharedArrayBuffer enabled** and verified in diagnostics
4. ✅ **Benchmark tests pass**: 30/60 FPS waterfall at target sample rates
5. ⬜ **Backpressure mechanism** implemented and tested
6. ⬜ **Metrics dashboard** displays pipeline health
7. ⬜ **Error recovery** tested for worker failures, buffer overruns
8. ✅ **WASM coverage documented** with performance benchmarks
9. ⬜ **Fallback paths verified** when SAB unavailable

## Implementation Plan

### Phase 1: Enable SharedArrayBuffer (Priority: High)

- [x] Add COOP/COEP headers to webpack-dev-server
- [x] Add COOP/COEP headers to production deployment
- [ ] Verify SharedArrayBuffer availability in diagnostics
- [ ] Test SharedRingBuffer in production environment

### Phase 2: Pipeline Integration (Priority: High)

- [ ] Integrate SharedRingBuffer with SDR device producers
- [ ] Route ring buffer to DSP worker pool
- [ ] Connect worker output to audio/visualization consumers
- [ ] Implement backpressure monitoring

### Phase 3: Metrics & Monitoring (Priority: Medium)

- [x] Extend `dsp-metrics.ts` for pipeline-wide metrics
- [x] Add metrics collection at each stage
- [ ] Create diagnostics dashboard UI
- [ ] Add performance warnings and alerts

### Phase 4: Error Handling (Priority: Medium)

- [ ] Implement worker restart on failure
- [ ] Add buffer overrun detection and recovery
- [ ] Implement WASM fallback logic
- [ ] Test error scenarios

### Phase 5: Benchmarking (Priority: High)

- [x] Create waterfall performance test (30/60 FPS)
- [ ] Measure throughput at 2.4 MSPS and 20 MSPS
- [ ] Validate latency targets (< 50ms end-to-end)
- [x] Document WASM coverage and performance gains

### Phase 6: Documentation (Priority: Medium)

- [ ] Update ARCHITECTURE.md with pipeline diagram
- [x] Document WASM coverage in reference docs
- [ ] Create troubleshooting guide for performance issues
- [ ] Add code examples for common patterns

## References

### Related ADRs

- **ADR-0002**: Web Worker DSP Architecture (foundational worker pool design)
- **ADR-0012**: Parallel FFT Worker Pool (advanced worker pool strategies)
- **ADR-0026**: Unified DSP Primitives Architecture (WASM primitives layer)

### Technical Standards

- [SharedArrayBuffer - MDN](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/SharedArrayBuffer)
- [Atomics - MDN](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Atomics)
- [Cross-Origin-Opener-Policy - W3C](https://www.w3.org/TR/coop/)
- [Cross-Origin-Embedder-Policy - W3C](https://www.w3.org/TR/coep/)

### Performance Research

- **Lock-free Ring Buffers**: Lamport, L. (1983). "Specifying Concurrent Program Modules." ACM TOPLAS
- **Web Workers Scalability**: IEEE (2015). "Performance Scalability Analysis of JavaScript Applications with Web Workers"
- **WebAssembly Performance**: Haas, A. et al. (2017). "Bringing the Web up to Speed with WebAssembly." PLDI

### Implementation Examples

- [ring-buffer - npm](https://www.npmjs.com/package/ring-buffer) - Reference implementations
- [AssemblyScript - GitHub](https://github.com/AssemblyScript/assemblyscript) - WASM toolchain
- [Web Audio API](https://webaudio.github.io/web-audio-api/) - Audio output integration

## Future Enhancements

### WASM Optimization Candidates

- **Polyphase resampling**: Complex filter banks benefit from SIMD
- **Digital demodulation**: PSK, QAM, OFDM cores
- **Adaptive equalizers**: Matrix operations (LMS, RLS algorithms)
- **Forward error correction**: Viterbi, Reed-Solomon decoders

### Advanced Features

- **GPU acceleration**: WebGPU compute shaders for FFT
- **Multi-stage pipelines**: Channelizer → per-channel demod workers
- **Dynamic worker scaling**: Adjust pool size based on load
- **Persistent workers**: Keep workers alive across sessions

### Performance Targets (Future)

- **100 MSPS**: For ultra-wideband SDRs
- **< 20ms latency**: For interactive applications
- **120 FPS**: High refresh rate displays
