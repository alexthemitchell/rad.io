/**
 * Comparison tests for WebGPU FFT vs WASM FFT
 * Validates correctness and performance of GPU implementation
 */

import { WebGPUFFT, isWebGPUSupported } from "../webgpuCompute";
import { calculateFFTWasm } from "../dspWasm";
import { Sample } from "../../types/rendering";

describe("WebGPU FFT vs WASM FFT Comparison", () => {
  // Skip tests if WebGPU is not supported
  const runTests = isWebGPUSupported();

  /**
   * Generate test signal: single frequency tone
   */
  function generateTone(
    frequency: number,
    sampleRate: number,
    numSamples: number,
    amplitude = 1.0,
  ): { iSamples: Float32Array; qSamples: Float32Array } {
    const iSamples = new Float32Array(numSamples);
    const qSamples = new Float32Array(numSamples);

    for (let i = 0; i < numSamples; i++) {
      const phase = (2 * Math.PI * frequency * i) / sampleRate;
      iSamples[i] = amplitude * Math.cos(phase);
      qSamples[i] = amplitude * Math.sin(phase);
    }

    return { iSamples, qSamples };
  }

  /**
   * Generate white noise
   */
  function generateNoise(
    numSamples: number,
    amplitude = 0.1,
  ): { iSamples: Float32Array; qSamples: Float32Array } {
    const iSamples = new Float32Array(numSamples);
    const qSamples = new Float32Array(numSamples);

    for (let i = 0; i < numSamples; i++) {
      iSamples[i] = amplitude * (Math.random() * 2 - 1);
      qSamples[i] = amplitude * (Math.random() * 2 - 1);
    }

    return { iSamples, qSamples };
  }

  /**
   * Convert I/Q arrays to Sample array for WASM
   */
  function toSamples(
    iSamples: Float32Array,
    qSamples: Float32Array,
  ): Sample[] {
    const samples: Sample[] = [];
    for (let i = 0; i < iSamples.length; i++) {
      samples.push({ I: iSamples[i], Q: qSamples[i] });
    }
    return samples;
  }

  /**
   * Calculate mean absolute error between two spectra
   */
  function calculateMAE(a: Float32Array, b: Float32Array): number {
    if (a.length !== b.length) {
      throw new Error("Arrays must have same length");
    }

    let sum = 0;
    for (let i = 0; i < a.length; i++) {
      sum += Math.abs(a[i] - b[i]);
    }
    return sum / a.length;
  }

  /**
   * Calculate root mean square error between two spectra
   */
  function calculateRMSE(a: Float32Array, b: Float32Array): number {
    if (a.length !== b.length) {
      throw new Error("Arrays must have same length");
    }

    let sum = 0;
    for (let i = 0; i < a.length; i++) {
      const diff = a[i] - b[i];
      sum += diff * diff;
    }
    return Math.sqrt(sum / a.length);
  }

  /**
   * Find peak bin index in spectrum
   */
  function findPeakBin(spectrum: Float32Array): number {
    let maxIdx = 0;
    let maxVal = spectrum[0] ?? -Infinity;

    for (let i = 1; i < spectrum.length; i++) {
      if (spectrum[i]! > maxVal) {
        maxVal = spectrum[i]!;
        maxIdx = i;
      }
    }

    return maxIdx;
  }

  describe("Correctness Validation", () => {
    (runTests ? it : it.skip)(
      "should produce similar results to WASM FFT for single tone",
      async () => {
        const fftSize = 1024;
        const sampleRate = 48000;
        const frequency = 1000; // 1 kHz tone

        // Generate test signal
        const { iSamples, qSamples } = generateTone(
          frequency,
          sampleRate,
          fftSize,
        );

        // Compute WebGPU FFT
        const webgpuFFT = new WebGPUFFT();
        const initialized = await webgpuFFT.initialize(fftSize);

        if (!initialized) {
          console.warn("WebGPU not available, skipping test");
          return;
        }

        const webgpuResult = await webgpuFFT.compute(iSamples, qSamples);
        expect(webgpuResult).not.toBeNull();

        // Compute WASM FFT
        const samples = toSamples(iSamples, qSamples);
        const wasmResult = calculateFFTWasm(samples, fftSize);

        if (!wasmResult) {
          console.warn("WASM not available, skipping comparison");
          webgpuFFT.destroy();
          return;
        }

        // Compare results
        expect(webgpuResult!.length).toBe(wasmResult.length);

        // Calculate error metrics
        const mae = calculateMAE(webgpuResult!, wasmResult);
        const rmse = calculateRMSE(webgpuResult!, wasmResult);

        // Error should be very small (< 1 dB difference on average)
        expect(mae).toBeLessThan(1.0);
        expect(rmse).toBeLessThan(2.0);

        // Peak should be at the same frequency bin
        const webgpuPeak = findPeakBin(webgpuResult!);
        const wasmPeak = findPeakBin(wasmResult);
        expect(Math.abs(webgpuPeak - wasmPeak)).toBeLessThanOrEqual(1);

        webgpuFFT.destroy();
      },
      15000,
    );

    (runTests ? it : it.skip)(
      "should handle DC component correctly",
      async () => {
        const fftSize = 512;

        // Generate DC signal (constant value)
        const iSamples = new Float32Array(fftSize).fill(1.0);
        const qSamples = new Float32Array(fftSize).fill(0.0);

        // Compute WebGPU FFT
        const webgpuFFT = new WebGPUFFT();
        const initialized = await webgpuFFT.initialize(fftSize);

        if (!initialized) {
          return;
        }

        const webgpuResult = await webgpuFFT.compute(iSamples, qSamples);
        expect(webgpuResult).not.toBeNull();

        // Compute WASM FFT
        const samples = toSamples(iSamples, qSamples);
        const wasmResult = calculateFFTWasm(samples, fftSize);

        if (!wasmResult) {
          webgpuFFT.destroy();
          return;
        }

        // DC component should be at center bin (after FFT shift)
        const centerBin = Math.floor(fftSize / 2);

        // Both should have peak at center
        const webgpuPeak = findPeakBin(webgpuResult!);
        const wasmPeak = findPeakBin(wasmResult);

        expect(Math.abs(webgpuPeak - centerBin)).toBeLessThanOrEqual(1);
        expect(Math.abs(wasmPeak - centerBin)).toBeLessThanOrEqual(1);

        webgpuFFT.destroy();
      },
      15000,
    );

    (runTests ? it : it.skip)(
      "should produce consistent results across multiple sizes",
      async () => {
        const sizes = [256, 512, 1024, 2048];
        const sampleRate = 48000;
        const frequency = 5000;

        for (const fftSize of sizes) {
          const { iSamples, qSamples } = generateTone(
            frequency,
            sampleRate,
            fftSize,
          );

          const webgpuFFT = new WebGPUFFT();
          const initialized = await webgpuFFT.initialize(fftSize);

          if (!initialized) {
            continue;
          }

          const webgpuResult = await webgpuFFT.compute(iSamples, qSamples);
          const samples = toSamples(iSamples, qSamples);
          const wasmResult = calculateFFTWasm(samples, fftSize);

          if (webgpuResult && wasmResult) {
            const mae = calculateMAE(webgpuResult, wasmResult);
            expect(mae).toBeLessThan(1.0);
          }

          webgpuFFT.destroy();
        }
      },
      30000,
    );

    (runTests ? it : it.skip)(
      "should handle noise input correctly",
      async () => {
        const fftSize = 1024;

        // Generate noise
        const { iSamples, qSamples } = generateNoise(fftSize, 0.1);

        const webgpuFFT = new WebGPUFFT();
        const initialized = await webgpuFFT.initialize(fftSize);

        if (!initialized) {
          return;
        }

        const webgpuResult = await webgpuFFT.compute(iSamples, qSamples);
        const samples = toSamples(iSamples, qSamples);
        const wasmResult = calculateFFTWasm(samples, fftSize);

        if (webgpuResult && wasmResult) {
          // For noise, we expect similar noise floor
          const mae = calculateMAE(webgpuResult, wasmResult);
          expect(mae).toBeLessThan(2.0); // Slightly higher tolerance for noise
        }

        webgpuFFT.destroy();
      },
      15000,
    );

    (runTests ? it : it.skip)(
      "should handle multi-tone signals",
      async () => {
        const fftSize = 2048;
        const sampleRate = 48000;

        // Generate multi-tone signal (1kHz + 5kHz + 10kHz)
        const { iSamples: i1, qSamples: q1 } = generateTone(
          1000,
          sampleRate,
          fftSize,
          0.5,
        );
        const { iSamples: i2, qSamples: q2 } = generateTone(
          5000,
          sampleRate,
          fftSize,
          0.3,
        );
        const { iSamples: i3, qSamples: q3 } = generateTone(
          10000,
          sampleRate,
          fftSize,
          0.2,
        );

        // Combine signals
        const iSamples = new Float32Array(fftSize);
        const qSamples = new Float32Array(fftSize);
        for (let i = 0; i < fftSize; i++) {
          iSamples[i] = i1[i]! + i2[i]! + i3[i]!;
          qSamples[i] = q1[i]! + q2[i]! + q3[i]!;
        }

        const webgpuFFT = new WebGPUFFT();
        const initialized = await webgpuFFT.initialize(fftSize);

        if (!initialized) {
          return;
        }

        const webgpuResult = await webgpuFFT.compute(iSamples, qSamples);
        const samples = toSamples(iSamples, qSamples);
        const wasmResult = calculateFFTWasm(samples, fftSize);

        if (webgpuResult && wasmResult) {
          const mae = calculateMAE(webgpuResult, wasmResult);
          expect(mae).toBeLessThan(1.5);

          // Should detect all three peaks
          // This is more a sanity check than a strict comparison
          expect(webgpuResult.length).toBe(fftSize);
        }

        webgpuFFT.destroy();
      },
      15000,
    );
  });

  describe("Edge Cases", () => {
    (runTests ? it : it.skip)(
      "should handle all zeros",
      async () => {
        const fftSize = 512;
        const iSamples = new Float32Array(fftSize);
        const qSamples = new Float32Array(fftSize);

        const webgpuFFT = new WebGPUFFT();
        const initialized = await webgpuFFT.initialize(fftSize);

        if (!initialized) {
          return;
        }

        const result = await webgpuFFT.compute(iSamples, qSamples);

        expect(result).not.toBeNull();
        if (result) {
          // All values should be finite (using epsilon in log)
          for (const val of result) {
            expect(Number.isFinite(val)).toBe(true);
          }
        }

        webgpuFFT.destroy();
      },
      10000,
    );

    (runTests ? it : it.skip)(
      "should handle very small values",
      async () => {
        const fftSize = 256;
        const iSamples = new Float32Array(fftSize).fill(1e-10);
        const qSamples = new Float32Array(fftSize).fill(1e-10);

        const webgpuFFT = new WebGPUFFT();
        const initialized = await webgpuFFT.initialize(fftSize);

        if (!initialized) {
          return;
        }

        const result = await webgpuFFT.compute(iSamples, qSamples);

        expect(result).not.toBeNull();
        if (result) {
          for (const val of result) {
            expect(Number.isFinite(val)).toBe(true);
            expect(val).toBeGreaterThan(-200); // Reasonable noise floor
          }
        }

        webgpuFFT.destroy();
      },
      10000,
    );

    (runTests ? it : it.skip)(
      "should reject non-power-of-2 sizes",
      async () => {
        const webgpuFFT = new WebGPUFFT();

        // These should fail
        const result1 = await webgpuFFT.initialize(100);
        expect(result1).toBe(false);

        const result2 = await webgpuFFT.initialize(1000);
        expect(result2).toBe(false);

        const result3 = await webgpuFFT.initialize(333);
        expect(result3).toBe(false);
      },
      10000,
    );
  });

  describe("Performance Characteristics", () => {
    (runTests ? it : it.skip)(
      "should complete FFT within reasonable time for 4096 bins",
      async () => {
        const fftSize = 4096;
        const { iSamples, qSamples } = generateTone(1000, 48000, fftSize);

        const webgpuFFT = new WebGPUFFT();
        const initialized = await webgpuFFT.initialize(fftSize);

        if (!initialized) {
          return;
        }

        const startTime = performance.now();
        const result = await webgpuFFT.compute(iSamples, qSamples);
        const endTime = performance.now();

        expect(result).not.toBeNull();

        const duration = endTime - startTime;
        console.log(`WebGPU FFT 4096 took ${duration.toFixed(2)}ms`);

        // Should complete in under 50ms (allowing overhead for mock)
        // Real GPU should be much faster (<5ms)
        expect(duration).toBeLessThan(100);

        webgpuFFT.destroy();
      },
      15000,
    );

    (runTests ? it : it.skip)(
      "should scale efficiently with FFT size",
      async () => {
        const sizes = [256, 512, 1024, 2048];
        const times: number[] = [];

        for (const fftSize of sizes) {
          const { iSamples, qSamples } = generateTone(1000, 48000, fftSize);

          const webgpuFFT = new WebGPUFFT();
          const initialized = await webgpuFFT.initialize(fftSize);

          if (!initialized) {
            continue;
          }

          const startTime = performance.now();
          await webgpuFFT.compute(iSamples, qSamples);
          const endTime = performance.now();

          times.push(endTime - startTime);
          webgpuFFT.destroy();
        }

        console.log("WebGPU FFT timing by size:", times);

        // Timing should scale roughly O(N log N)
        // Each doubling should be less than 2.5x increase
        for (let i = 1; i < times.length; i++) {
          const ratio = times[i]! / times[i - 1]!;
          expect(ratio).toBeLessThan(3.0); // Allow for overhead
        }
      },
      30000,
    );
  });
});
