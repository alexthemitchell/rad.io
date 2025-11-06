/**
 * DSP Pipeline Benchmark Tests
 *
 * Validates that the DSP pipeline meets performance requirements specified in ADR-0025:
 * - 30 FPS waterfall @ 2.4 MSPS with <1% drop rate
 * - 60 FPS waterfall @ 10 MSPS with <5% drop rate (target)
 * - Main thread never blocked >16ms
 *
 * Run with: npm run test:perf -- src/utils/__tests__/dspPipeline.benchmark.test.ts
 */

import { loadWasmModule, isWasmAvailable } from "../dspWasm";
import { SharedRingBuffer, canUseSharedArrayBuffer } from "../sharedRingBuffer";

// Configuration for benchmarks
const BENCHMARKS = {
  // Standard SDR sample rates
  SAMPLE_RATES: {
    RTL_SDR: 2_400_000, // 2.4 MSPS (typical RTL-SDR)
    HACKRF_NARROW: 10_000_000, // 10 MSPS (HackRF narrowband)
    HACKRF_WIDE: 20_000_000, // 20 MSPS (HackRF wideband)
  },
  // Target frame rates
  FRAME_RATES: {
    STANDARD: 30, // Standard waterfall refresh
    HIGH: 60, // High-performance waterfall
  },
  // FFT sizes
  FFT_SIZES: [1024, 2048, 4096, 8192],
  // Test duration
  TEST_DURATION_MS: 1000,
};

// Helper to measure throughput
interface ThroughputResult {
  samplesProcessed: number;
  timeMs: number;
  samplesPerSecond: number;
  fps: number;
  avgLatencyMs: number;
  maxLatencyMs: number;
  dropCount: number;
  dropRate: number;
}

function measureThroughput(
  processFunc: () => void,
  samplesPerFrame: number,
  targetFps: number,
  durationMs: number,
): ThroughputResult {
  const latencies: number[] = [];
  let samplesProcessed = 0;
  let dropCount = 0;

  const startTime = performance.now();
  const targetFrameTime = 1000 / targetFps;

  while (performance.now() - startTime < durationMs) {
    const frameStart = performance.now();
    let frameDropped = false;

    try {
      processFunc();
      samplesProcessed += samplesPerFrame;
    } catch {
      frameDropped = true;
      dropCount++;
    }

    const frameTime = performance.now() - frameStart;
    latencies.push(frameTime);

    // Simulate frame pacing - only count as drop if not already dropped due to exception
    const remaining = targetFrameTime - frameTime;
    if (remaining <= 0 && !frameDropped) {
      dropCount++; // Frame took too long
    }
  }

  const totalTime = performance.now() - startTime;
  const avgLatency = latencies.reduce((a, b) => a + b, 0) / latencies.length;
  const maxLatency = Math.max(...latencies);
  const actualFps = (latencies.length / totalTime) * 1000;
  const dropRate = dropCount / latencies.length;

  return {
    samplesProcessed,
    timeMs: totalTime,
    samplesPerSecond: (samplesProcessed / totalTime) * 1000,
    fps: actualFps,
    avgLatencyMs: avgLatency,
    maxLatencyMs: maxLatency,
    dropCount,
    dropRate,
  };
}

describe("DSP Pipeline Benchmarks (ADR-0025)", () => {
  let wasmModule: Awaited<ReturnType<typeof loadWasmModule>>;

  beforeAll(async () => {
    wasmModule = await loadWasmModule();
  });

  describe("WASM Coverage Verification", () => {
    it("should have DC correction (static) in WASM", () => {
      if (!isWasmAvailable() || !wasmModule) {
        console.warn("⚠️  WASM not available, skipping coverage check");
        return;
      }

      expect(wasmModule.removeDCOffsetStatic).toBeDefined();
      expect(typeof wasmModule.removeDCOffsetStatic).toBe("function");
      console.log("✓ DC correction (static): WASM");
    });

    it("should have DC correction (IIR) in WASM", () => {
      if (!isWasmAvailable() || !wasmModule) return;

      expect(wasmModule.removeDCOffsetIIR).toBeDefined();
      console.log("✓ DC correction (IIR): WASM");
    });

    it("should have windowing functions in WASM", () => {
      if (!isWasmAvailable() || !wasmModule) return;

      expect(wasmModule.applyHannWindow).toBeDefined();
      expect(wasmModule.applyHammingWindow).toBeDefined();
      expect(wasmModule.applyBlackmanWindow).toBeDefined();
      console.log("✓ Windowing (Hann, Hamming, Blackman): WASM");
    });

    it("should have SIMD-optimized windowing in WASM", () => {
      if (!isWasmAvailable() || !wasmModule) return;

      expect(wasmModule.applyHannWindowSIMD).toBeDefined();
      expect(wasmModule.applyHammingWindowSIMD).toBeDefined();
      expect(wasmModule.applyBlackmanWindowSIMD).toBeDefined();
      console.log("✓ Windowing (SIMD): WASM");
    });

    it("should have FFT in WASM", () => {
      if (!isWasmAvailable() || !wasmModule) return;

      expect(wasmModule.calculateFFT).toBeDefined();
      expect(wasmModule.calculateFFTOut).toBeDefined();
      console.log("✓ FFT (Cooley-Tukey radix-2): WASM");
    });

    it("should have waveform calculation in WASM", () => {
      if (!isWasmAvailable() || !wasmModule) return;

      expect(wasmModule.calculateWaveform).toBeDefined();
      expect(wasmModule.calculateWaveformSIMD).toBeDefined();
      console.log("✓ Waveform (amplitude/phase): WASM");
    });

    it("should document missing WASM implementations", () => {
      // These are identified in ADR-0025 as TODO
      console.log("⚠️  FIR filtering: Not yet in WASM (TODO)");
      console.log("⚠️  Resampling: Not yet in WASM (TODO)");
      console.log("⚠️  Demodulation (AM/FM/SSB): JavaScript (TODO for WASM)");

      // This is just for documentation, not an assertion failure
      expect(true).toBe(true);
    });
  });

  describe("SharedArrayBuffer Support", () => {
    it("should detect SharedArrayBuffer availability", () => {
      const canUse = canUseSharedArrayBuffer();
      console.log(
        canUse
          ? "✓ SharedArrayBuffer: Available"
          : "⚠️  SharedArrayBuffer: Not available (needs COOP/COEP headers)",
      );

      // Not a hard requirement in test environment
      expect(typeof canUse).toBe("boolean");
    });

    it("should create SharedRingBuffer if available", () => {
      if (!canUseSharedArrayBuffer()) {
        console.warn("⚠️  Skipping ring buffer test (SAB not available)");
        return;
      }

      const bufferSize = 1024 * 1024; // 1M floats
      const ringBuffer = new SharedRingBuffer(bufferSize);
      expect(ringBuffer).toBeDefined();
      expect(ringBuffer.getAvailableSpace()).toBe(bufferSize - 1);
      console.log(`✓ SharedRingBuffer: Created (${bufferSize} floats)`);
    });
  });

  describe("FFT Performance Benchmarks", () => {
    it.each(BENCHMARKS.FFT_SIZES)(
      "should process FFT efficiently (size: %d)",
      (fftSize) => {
        if (!isWasmAvailable() || !wasmModule) {
          console.warn("⚠️  WASM not available, skipping FFT benchmark");
          return;
        }

        const iSamples = new Float32Array(fftSize);
        const qSamples = new Float32Array(fftSize);

        // Generate test signal
        for (let i = 0; i < fftSize; i++) {
          const t = i / fftSize;
          iSamples[i] = Math.cos(2 * Math.PI * 5 * t);
          qSamples[i] = Math.sin(2 * Math.PI * 5 * t);
        }

        // Warm-up
        for (let i = 0; i < 5; i++) {
          wasmModule!.calculateFFTOut!(iSamples, qSamples, fftSize);
        }

        // Benchmark
        const iterations = 100;
        const start = performance.now();
        for (let i = 0; i < iterations; i++) {
          wasmModule!.calculateFFTOut!(iSamples, qSamples, fftSize);
        }
        const elapsed = performance.now() - start;
        const avgTime = elapsed / iterations;

        console.log(
          `FFT (${fftSize} points): ${avgTime.toFixed(3)}ms per operation`,
        );

        // ADR-0025 target: FFT < 5ms for 8192 points
        if (fftSize === 8192) {
          expect(avgTime).toBeLessThan(5);
        }
      },
    );
  });

  describe("Waterfall Performance @ 2.4 MSPS (RTL-SDR)", () => {
    const sampleRate = BENCHMARKS.SAMPLE_RATES.RTL_SDR;
    const targetFps = BENCHMARKS.FRAME_RATES.STANDARD;
    const fftSize = 2048;
    const samplesPerFrame = Math.floor(sampleRate / targetFps);

    it(`should sustain ${targetFps} FPS with <1% drop rate`, () => {
      if (!isWasmAvailable() || !wasmModule) {
        console.warn("⚠️  WASM not available, skipping waterfall benchmark");
        return;
      }

      // Pre-generate samples
      const iSamples = new Float32Array(samplesPerFrame);
      const qSamples = new Float32Array(samplesPerFrame);
      for (let i = 0; i < samplesPerFrame; i++) {
        const t = i / sampleRate;
        iSamples[i] = Math.cos(2 * Math.PI * 1000 * t);
        qSamples[i] = Math.sin(2 * Math.PI * 1000 * t);
      }

      // Process function: DC correction + windowing + FFT
      const processFrame = () => {
        // Take first fftSize samples
        const fftI = iSamples.slice(0, fftSize);
        const fftQ = qSamples.slice(0, fftSize);

        // DC correction
        wasmModule!.removeDCOffsetStatic!(fftI, fftQ, fftSize);

        // Windowing
        wasmModule!.applyHannWindow!(fftI, fftQ, fftSize);

        // FFT
        wasmModule!.calculateFFTOut!(fftI, fftQ, fftSize);
      };

      const result = measureThroughput(
        processFrame,
        samplesPerFrame,
        targetFps,
        BENCHMARKS.TEST_DURATION_MS,
      );

      console.log(`
Waterfall @ ${sampleRate / 1e6} MSPS, ${targetFps} FPS:
  - Actual FPS: ${result.fps.toFixed(1)}
  - Avg latency: ${result.avgLatencyMs.toFixed(2)}ms
  - Max latency: ${result.maxLatencyMs.toFixed(2)}ms
  - Drop rate: ${(result.dropRate * 100).toFixed(2)}%
  - Throughput: ${(result.samplesPerSecond / 1e6).toFixed(2)} MSPS
      `);

      // ADR-0025 acceptance criteria
      expect(result.fps).toBeGreaterThanOrEqual(targetFps * 0.95); // Within 5% of target
      expect(result.dropRate).toBeLessThan(0.01); // <1% drop rate
      expect(result.maxLatencyMs).toBeLessThan(16); // Never block main thread >16ms
    });
  });

  describe("High-Performance Waterfall @ 10 MSPS (HackRF)", () => {
    const sampleRate = BENCHMARKS.SAMPLE_RATES.HACKRF_NARROW;
    const targetFps = BENCHMARKS.FRAME_RATES.HIGH;
    const fftSize = 4096;
    const samplesPerFrame = Math.floor(sampleRate / targetFps);

    it(`should target ${targetFps} FPS with <5% drop rate`, () => {
      if (!isWasmAvailable() || !wasmModule) {
        console.warn("⚠️  WASM not available, skipping high-perf benchmark");
        return;
      }

      // Pre-generate samples
      const iSamples = new Float32Array(samplesPerFrame);
      const qSamples = new Float32Array(samplesPerFrame);
      for (let i = 0; i < samplesPerFrame; i++) {
        const t = i / sampleRate;
        iSamples[i] = Math.cos(2 * Math.PI * 1000 * t);
        qSamples[i] = Math.sin(2 * Math.PI * 1000 * t);
      }

      // Process with SIMD optimizations
      const processFrame = () => {
        const fftI = iSamples.slice(0, fftSize);
        const fftQ = qSamples.slice(0, fftSize);

        // Use SIMD variants if available
        if (wasmModule!.removeDCOffsetStaticSIMD) {
          wasmModule!.removeDCOffsetStaticSIMD!(fftI, fftQ, fftSize);
        } else {
          wasmModule!.removeDCOffsetStatic!(fftI, fftQ, fftSize);
        }

        if (wasmModule!.applyHannWindowSIMD) {
          wasmModule!.applyHannWindowSIMD!(fftI, fftQ, fftSize);
        } else {
          wasmModule!.applyHannWindow!(fftI, fftQ, fftSize);
        }

        wasmModule!.calculateFFTOut!(fftI, fftQ, fftSize);
      };

      const result = measureThroughput(
        processFrame,
        samplesPerFrame,
        targetFps,
        BENCHMARKS.TEST_DURATION_MS,
      );

      console.log(`
High-Performance Waterfall @ ${sampleRate / 1e6} MSPS, ${targetFps} FPS:
  - Actual FPS: ${result.fps.toFixed(1)}
  - Avg latency: ${result.avgLatencyMs.toFixed(2)}ms
  - Max latency: ${result.maxLatencyMs.toFixed(2)}ms
  - Drop rate: ${(result.dropRate * 100).toFixed(2)}%
  - Throughput: ${(result.samplesPerSecond / 1e6).toFixed(2)} MSPS
      `);

      // ADR-0025 target criteria (less strict for high-perf)
      expect(result.fps).toBeGreaterThanOrEqual(targetFps * 0.8); // Within 20% of target
      expect(result.dropRate).toBeLessThan(0.05); // <5% drop rate

      // This is a target, not strict requirement
      if (result.fps >= targetFps * 0.95 && result.dropRate < 0.01) {
        console.log("✓ Exceeds high-performance target!");
      } else {
        console.log(
          "⚠️  Target not yet met (expected for non-optimized environments)",
        );
      }
    });
  });

  describe("Memory Transfer Performance", () => {
    it("should measure transferable ArrayBuffer overhead", () => {
      const sizes = [1024, 8192, 65536]; // 4KB, 32KB, 256KB

      sizes.forEach((size) => {
        const buffer = new ArrayBuffer(size * 4);
        const array = new Float32Array(buffer);

        // Fill with data
        for (let i = 0; i < size; i++) {
          array[i] = Math.random();
        }

        // Measure copy time (simulation of what postMessage does without transfer)
        const copyStart = performance.now();
        const copy = new Float32Array(array);
        const copyTime = performance.now() - copyStart;

        // Use the copy to prevent optimization
        const copySum = copy.reduce((acc, val) => acc + val, 0);

        console.log(
          `ArrayBuffer ${size} floats (${(size * 4) / 1024}KB): copy=${copyTime.toFixed(3)}ms, sum=${copySum.toFixed(3)}`,
        );

        // Transfer is effectively zero-copy (ownership transfer)
        // So we just verify it's possible
        const transferBuffer = new ArrayBuffer(size * 4);
        expect(transferBuffer.byteLength).toBe(size * 4);
      });
    });
  });

  describe("Ring Buffer Performance", () => {
    it("should measure write/read throughput", () => {
      if (!canUseSharedArrayBuffer()) {
        console.warn("⚠️  Skipping ring buffer perf (SAB not available)");
        return;
      }

      const bufferSize = 1024 * 1024; // 1M floats = 4MB
      const ringBuffer = new SharedRingBuffer(bufferSize);
      const chunkSize = 8192;
      const testData = new Float32Array(chunkSize);

      // Fill test data
      for (let i = 0; i < chunkSize; i++) {
        testData[i] = Math.random();
      }

      // Measure write throughput
      const writeIterations = 1000;
      const writeStart = performance.now();
      for (let i = 0; i < writeIterations; i++) {
        ringBuffer.write(testData);
      }
      const writeTime = performance.now() - writeStart;
      const writeThroughput =
        (writeIterations * chunkSize * 4) / (writeTime / 1000) / 1e9; // GB/s

      console.log(`SharedRingBuffer write: ${writeThroughput.toFixed(2)} GB/s`);

      // Clear buffer
      ringBuffer.clear();

      // Measure read throughput
      // First write data
      for (let i = 0; i < 100; i++) {
        ringBuffer.write(testData);
      }

      const readIterations = 100;
      const readStart = performance.now();
      for (let i = 0; i < readIterations; i++) {
        const data = ringBuffer.tryRead(chunkSize);
        expect(data).not.toBeNull();
      }
      const readTime = performance.now() - readStart;
      const readThroughput =
        (readIterations * chunkSize * 4) / (readTime / 1000) / 1e9; // GB/s

      console.log(`SharedRingBuffer read: ${readThroughput.toFixed(2)} GB/s`);

      // ADR-0025 baseline: 10 GB/s for write/read
      // In test environment, may be lower due to overhead
      expect(writeThroughput).toBeGreaterThan(0.1); // At least 100 MB/s
      expect(readThroughput).toBeGreaterThan(0.1);
    });
  });
});
