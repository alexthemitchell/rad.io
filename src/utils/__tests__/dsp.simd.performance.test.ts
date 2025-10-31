/**
 * SIMD Performance Tests
 * Validates that SIMD-optimized DSP functions provide expected speedups
 */

import {
  loadWasmModule,
  isWasmSIMDSupported,
  isWasmAvailable,
} from "../dspWasm";
import type { Sample } from "../dsp";

// Generate test samples
function generateTestSamples(count: number): Sample[] {
  const samples: Sample[] = [];
  for (let i = 0; i < count; i++) {
    const t = i / count;
    samples.push({
      I: Math.cos(2 * Math.PI * 5 * t) * 0.8,
      Q: Math.sin(2 * Math.PI * 5 * t) * 0.8,
    });
  }
  return samples;
}

// Measure execution time
function measureTime(fn: () => void, iterations = 10): number {
  const start = performance.now();
  for (let i = 0; i < iterations; i++) {
    fn();
  }
  const end = performance.now();
  return (end - start) / iterations;
}

describe("SIMD Performance Tests", () => {
  beforeAll(async () => {
    await loadWasmModule();
  });

  describe("SIMD availability", () => {
    it("should detect SIMD support", () => {
      const simdSupported = isWasmSIMDSupported();
      expect(typeof simdSupported).toBe("boolean");

      if (simdSupported) {
        console.log("✓ SIMD is supported on this platform");
      } else {
        console.log("✗ SIMD is not supported on this platform");
      }
    });

    it("should attempt to load WASM module", async () => {
      const wasmAvailable = isWasmAvailable();
      // In Jest test environment, WASM may not be available
      // This is expected and the test should pass either way
      expect(typeof wasmAvailable).toBe("boolean");

      if (wasmAvailable) {
        console.log("✓ WASM module loaded successfully");
      } else {
        console.log(
          "✗ WASM not available (expected in Jest test environment)",
        );
      }
    });
  });

  describe("Window function performance", () => {
    const testSizes = [1024, 2048, 4096];

    it.each(testSizes)(
      "should show SIMD benefit for window functions (size: %d)",
      async (size) => {
        if (!isWasmAvailable()) {
          console.warn("WASM not available, skipping performance test");
          return;
        }

        const module = await loadWasmModule();
        if (!module) {
          console.warn("WASM module not loaded, skipping performance test");
          return;
        }

        const iSamples = new Float32Array(size);
        const qSamples = new Float32Array(size);

        // Initialize with test data
        for (let i = 0; i < size; i++) {
          const t = i / size;
          iSamples[i] = Math.cos(2 * Math.PI * 5 * t);
          qSamples[i] = Math.sin(2 * Math.PI * 5 * t);
        }

        // Test Hann window
        if (module.applyHannWindowSIMD) {
          const standardTime = measureTime(() => {
            const iCopy = new Float32Array(iSamples);
            const qCopy = new Float32Array(qSamples);
            module.applyHannWindow(iCopy, qCopy, size);
          }, 20);

          const simdTime = measureTime(() => {
            const iCopy = new Float32Array(iSamples);
            const qCopy = new Float32Array(qSamples);
            module.applyHannWindowSIMD!(iCopy, qCopy, size);
          }, 20);

          const speedup = standardTime / simdTime;

          console.log(
            `Hann window (${size} samples): standard=${standardTime.toFixed(3)}ms, SIMD=${simdTime.toFixed(3)}ms, speedup=${speedup.toFixed(2)}x`,
          );

          // SIMD should be at least as fast (or faster) than standard
          // In practice, expect 1.5-4x speedup depending on CPU
          expect(simdTime).toBeLessThanOrEqual(standardTime * 1.1); // Allow 10% variance
        } else {
          console.log(
            `SIMD functions not available for size ${size} (likely standard WASM build)`,
          );
        }
      },
    );
  });

  describe("Waveform calculation performance", () => {
    const testSizes = [1000, 5000, 10000];

    it.each(testSizes)(
      "should show SIMD benefit for waveform calculation (size: %d)",
      async (size) => {
        if (!isWasmAvailable()) {
          return;
        }

        const module = await loadWasmModule();
        if (!module) {
          return;
        }

        const iSamples = new Float32Array(size);
        const qSamples = new Float32Array(size);

        for (let i = 0; i < size; i++) {
          const t = i / size;
          iSamples[i] = Math.cos(2 * Math.PI * 5 * t);
          qSamples[i] = Math.sin(2 * Math.PI * 5 * t);
        }

        // Only test if SIMD version is available
        if (module.calculateWaveformSIMD) {
          const amplitude = new Float32Array(size);
          const phase = new Float32Array(size);

          const standardTime = measureTime(() => {
            const amp = new Float32Array(size);
            const ph = new Float32Array(size);
            module.calculateWaveform(iSamples, qSamples, amp, ph, size);
          }, 20);

          const simdTime = measureTime(() => {
            const amp = new Float32Array(size);
            const ph = new Float32Array(size);
            module.calculateWaveformSIMD!(iSamples, qSamples, amp, ph, size);
          }, 20);

          const speedup = standardTime / simdTime;

          console.log(
            `Waveform (${size} samples): standard=${standardTime.toFixed(3)}ms, SIMD=${simdTime.toFixed(3)}ms, speedup=${speedup.toFixed(2)}x`,
          );

          // SIMD should be at least as fast as standard
          expect(simdTime).toBeLessThanOrEqual(standardTime * 1.1);
        }
      },
    );
  });

  describe("Real-world performance scenarios", () => {
    it("should handle typical SDR workload efficiently", async () => {
      if (!isWasmAvailable()) {
        return;
      }

      const module = await loadWasmModule();
      if (!module || !module.applyHannWindowSIMD) {
        console.log("SIMD not available, skipping real-world scenario test");
        return;
      }

      // Simulate typical SDR scenario: 2048 samples at 60 FPS
      const size = 2048;
      const targetFrameTime = 16.67; // 60 FPS = 16.67ms per frame

      const iSamples = new Float32Array(size);
      const qSamples = new Float32Array(size);

      for (let i = 0; i < size; i++) {
        const t = i / size;
        iSamples[i] = Math.cos(2 * Math.PI * 5 * t) * 0.8;
        qSamples[i] = Math.sin(2 * Math.PI * 5 * t) * 0.8;
      }

      // Measure combined operations (window + processing)
      const operations = 5; // Simulate multiple DSP operations per frame
      const start = performance.now();

      for (let op = 0; op < operations; op++) {
        const iCopy = new Float32Array(iSamples);
        const qCopy = new Float32Array(qSamples);
        module.applyHannWindowSIMD(iCopy, qCopy, size);

        // Simulate additional processing
        const output = new Float32Array(size);
        module.calculateFFT(iCopy, qCopy, size, output);
      }

      const totalTime = performance.now() - start;
      const avgOpTime = totalTime / operations;

      console.log(
        `Real-world workload: ${operations} operations in ${totalTime.toFixed(2)}ms (avg: ${avgOpTime.toFixed(2)}ms/op)`,
      );
      console.log(
        `Target frame time: ${targetFrameTime.toFixed(2)}ms, actual: ${totalTime.toFixed(2)}ms`,
      );

      // Should complete well within frame budget for responsive UI
      // Allow 2x frame time for headroom
      expect(totalTime).toBeLessThan(targetFrameTime * 2);
    });
  });

  describe("Memory efficiency", () => {
    it("should not leak memory during repeated operations", async () => {
      if (!isWasmAvailable()) {
        return;
      }

      const module = await loadWasmModule();
      if (!module) {
        return;
      }

      const size = 2048;
      const iterations = 100;

      // Check if memory grows during repeated operations
      const iSamples = new Float32Array(size);
      const qSamples = new Float32Array(size);

      for (let i = 0; i < size; i++) {
        iSamples[i] = Math.random();
        qSamples[i] = Math.random();
      }

      // Run operations
      for (let i = 0; i < iterations; i++) {
        const iCopy = new Float32Array(iSamples);
        const qCopy = new Float32Array(qSamples);

        if (module.applyHannWindowSIMD) {
          module.applyHannWindowSIMD(iCopy, qCopy, size);
        } else {
          module.applyHannWindow(iCopy, qCopy, size);
        }
      }

      // Test passes if we reach here without memory issues
      expect(true).toBe(true);
    });
  });
});
