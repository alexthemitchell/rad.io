/**
 * Example test using signal generators and test utilities
 *
 * This test demonstrates best practices for using the test data generators
 * and utilities provided by rad.io's testing infrastructure.
 */

import {
  generateIQSamples,
  generateMultiToneIQ,
  generateFMIQ,
  calculateSNR,
} from "../signalGenerator";
import {
  expectFloat32ArraysClose,
  SeededRandom,
  waitForCondition,
} from "../testHelpers";

describe("Signal Generator Examples", () => {
  describe("Basic IQ Generation", () => {
    test("should generate pure sinusoid with expected properties", () => {
      const samples = generateIQSamples({
        sampleRate: 2048000,
        frequency: 100000,
        amplitude: 0.8,
        duration: 0.1,
      });

      // Verify basic properties
      expect(samples.sampleRate).toBe(2048000);
      expect(samples.length).toBe(204800); // 2048000 * 0.1
      expect(samples.samples.length).toBe(204800 * 2); // I/Q interleaved

      // Verify amplitude is approximately correct
      const maxAmplitude = samples.samples.reduce(
        (max, val) => Math.max(max, Math.abs(val)),
        0,
      );
      expect(maxAmplitude).toBeCloseTo(0.8, 1);
    });

    test("should generate signal with high SNR", () => {
      const samples = generateIQSamples({
        sampleRate: 2048000,
        frequency: 100000,
        amplitude: 0.8,
        duration: 0.1,
        noiseLevel: 0.01,
      });

      const snr = calculateSNR(samples.samples, 100000, 2048000);
      expect(snr).toBeGreaterThan(30); // Should have >30 dB SNR
    });
  });

  describe("Multi-Tone Signals", () => {
    test("should generate multiple tones at specified frequencies", () => {
      const samples = generateMultiToneIQ({
        sampleRate: 2048000,
        tones: [
          { frequency: 100000, amplitude: 0.8 },
          { frequency: 200000, amplitude: 0.5 },
          { frequency: 300000, amplitude: 0.3 },
        ],
        duration: 0.1,
      });

      expect(samples.length).toBe(204800);

      // Verify the signal contains multiple frequencies
      // (In practice, you'd use FFT to verify each tone is present)
      const maxAmplitude = samples.samples.reduce(
        (max, val) => Math.max(max, Math.abs(val)),
        0,
      );

      // Max amplitude should be sum of individual amplitudes
      expect(maxAmplitude).toBeLessThanOrEqual(0.8 + 0.5 + 0.3 + 0.1);
    });
  });

  describe("Modulated Signals", () => {
    test("should generate FM signal", () => {
      const fmSignal = generateFMIQ({
        sampleRate: 2048000,
        carrierFreq: 100000,
        modulationFreq: 1000,
        deviation: 5000,
        amplitude: 0.8,
        duration: 0.1,
      });

      expect(fmSignal.length).toBe(204800);

      // Verify constant amplitude (characteristic of FM)
      const amplitudes = new Float32Array(fmSignal.length);
      for (let i = 0; i < fmSignal.length; i++) {
        const iSample = fmSignal.samples[i * 2];
        const qSample = fmSignal.samples[i * 2 + 1];

        if (iSample !== undefined && qSample !== undefined) {
          amplitudes[i] = Math.sqrt(iSample * iSample + qSample * qSample);
        }
      }

      const avgAmplitude =
        amplitudes.reduce((sum, val) => sum + val, 0) / fmSignal.length;
      expect(avgAmplitude).toBeCloseTo(0.8, 1);
    });
  });

  describe("Deterministic Random Generation", () => {
    test("should generate reproducible random sequences", () => {
      const rng1 = new SeededRandom(42);
      const rng2 = new SeededRandom(42);

      // Generate same sequence from both RNGs
      const values1 = Array.from({ length: 10 }, () => rng1.next());
      const values2 = Array.from({ length: 10 }, () => rng2.next());

      // Sequences should be identical
      expectFloat32ArraysClose(
        new Float32Array(values1),
        new Float32Array(values2),
        1e-10,
      );
    });

    test("should reset to initial seed", () => {
      const rng = new SeededRandom(42);

      const firstValue = rng.next();
      rng.next();
      rng.next();

      // Reset and verify we get the same first value
      rng.reset(42);
      expect(rng.next()).toBe(firstValue);
    });
  });

  describe("Array Comparison Utilities", () => {
    test("should compare Float32Arrays with tolerance", () => {
      const arr1 = new Float32Array([1.0, 2.0, 3.0]);
      const arr2 = new Float32Array([1.00001, 2.00001, 3.00001]);

      // Should not throw with appropriate tolerance
      expect(() => {
        expectFloat32ArraysClose(arr1, arr2, 1e-4);
      }).not.toThrow();
    });

    test("should fail when arrays differ beyond tolerance", () => {
      const arr1 = new Float32Array([1.0, 2.0, 3.0]);
      const arr2 = new Float32Array([1.1, 2.0, 3.0]);

      expect(() => {
        expectFloat32ArraysClose(arr1, arr2, 1e-6);
      }).toThrow(/Arrays differ at index 0/);
    });
  });

  describe("Async Testing Utilities", () => {
    test("should wait for condition to be true", async () => {
      let value = false;

      // Set value to true after 100ms
      setTimeout(() => {
        value = true;
      }, 100);

      // Wait for condition
      await waitForCondition(() => value === true, 1000, 10);

      expect(value).toBe(true);
    });

    test("should timeout when condition is not met", async () => {
      await expect(waitForCondition(() => false, 100, 10)).rejects.toThrow(
        "Condition timeout exceeded",
      );
    });
  });
});

describe("Real-World Testing Patterns", () => {
  test("should validate DSP pipeline with synthetic signal", () => {
    // Generate a known signal
    const testSignal = generateIQSamples({
      sampleRate: 2048000,
      frequency: 100000,
      amplitude: 0.8,
      duration: 0.1,
    });

    // In a real test, you would:
    // 1. Pass samples through your DSP pipeline
    // 2. Verify output characteristics
    // 3. Check for expected frequency components
    // 4. Validate amplitude/phase relationships

    // Example: Basic validation
    expect(testSignal.samples.length).toBeGreaterThan(0);
    expect(testSignal.sampleRate).toBe(2048000);
  });

  test("should handle edge cases with deterministic data", () => {
    const rng = new SeededRandom(12345);

    // Test with various deterministic inputs
    for (let i = 0; i < 10; i++) {
      const frequency = rng.range(10000, 500000);
      const amplitude = rng.range(0.1, 1.0);

      const samples = generateIQSamples({
        sampleRate: 2048000,
        frequency,
        amplitude,
        duration: 0.05,
      });

      // Verify basic properties hold for all inputs
      expect(samples.length).toBe(102400);
      expect(samples.samples.length).toBe(204800);
    }
  });
});
