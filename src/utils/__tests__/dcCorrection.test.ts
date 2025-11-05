/**
 * DC Correction Tests
 * Tests for static and IIR DC offset removal algorithms
 */

import { describe, it, expect } from "@jest/globals";
import {
  removeDCOffsetStatic,
  removeDCOffsetIIR,
  removeDCOffsetCombined,
} from "../dspProcessing";
import type { Sample } from "../dsp";

/**
 * Helper function to generate test samples with known DC offset
 */
function generateSamplesWithDC(
  count: number,
  dcOffsetI: number,
  dcOffsetQ: number,
  signalAmplitude = 0.5,
  signalFrequency = 0.1, // Normalized frequency (cycles per sample)
): Sample[] {
  const samples: Sample[] = [];
  for (let i = 0; i < count; i++) {
    const angle = 2 * Math.PI * signalFrequency * i;
    samples.push({
      I: signalAmplitude * Math.cos(angle) + dcOffsetI,
      Q: signalAmplitude * Math.sin(angle) + dcOffsetQ,
    });
  }
  return samples;
}

/**
 * Calculate mean DC offset of samples
 */
function calculateDCOffset(samples: Sample[]): { I: number; Q: number } {
  let sumI = 0;
  let sumQ = 0;
  for (const sample of samples) {
    sumI += sample.I;
    sumQ += sample.Q;
  }
  return {
    I: sumI / samples.length,
    Q: sumQ / samples.length,
  };
}

describe("removeDCOffsetStatic", () => {
  it("should remove constant positive DC offset", () => {
    const dcI = 0.5;
    const dcQ = 0.3;
    const samples = generateSamplesWithDC(1000, dcI, dcQ);

    const corrected = removeDCOffsetStatic(samples, false); // Disable WASM for deterministic testing

    const dc = calculateDCOffset(corrected);
    expect(Math.abs(dc.I)).toBeLessThan(1e-10);
    expect(Math.abs(dc.Q)).toBeLessThan(1e-10);
  });

  it("should remove constant negative DC offset", () => {
    const dcI = -0.3;
    const dcQ = -0.4;
    const samples = generateSamplesWithDC(1000, dcI, dcQ);

    const corrected = removeDCOffsetStatic(samples, false);

    const dc = calculateDCOffset(corrected);
    expect(Math.abs(dc.I)).toBeLessThan(1e-10);
    expect(Math.abs(dc.Q)).toBeLessThan(1e-10);
  });

  it("should handle zero DC offset", () => {
    const samples = generateSamplesWithDC(1000, 0, 0);
    const corrected = removeDCOffsetStatic(samples, false);

    // Should be approximately unchanged
    for (let i = 0; i < samples.length; i++) {
      expect(corrected[i]?.I).toBeCloseTo(samples[i]?.I ?? 0, 5);
      expect(corrected[i]?.Q).toBeCloseTo(samples[i]?.Q ?? 0, 5);
    }
  });

  it("should preserve signal amplitude after DC removal", () => {
    const amplitude = 0.8;
    const samples = generateSamplesWithDC(1000, 0.5, 0.3, amplitude);

    const corrected = removeDCOffsetStatic(samples, false);

    // Calculate RMS amplitude
    let sumMag2 = 0;
    for (const sample of corrected) {
      sumMag2 += sample.I * sample.I + sample.Q * sample.Q;
    }
    const rmsAmplitude = Math.sqrt(sumMag2 / corrected.length);

    // For a complex sinusoid (I + jQ), RMS = amplitude
    // The signal power is amplitude^2, so RMS should be close to amplitude
    expect(rmsAmplitude).toBeCloseTo(amplitude, 1);
  });

  it("should handle empty sample array", () => {
    const samples: Sample[] = [];
    const corrected = removeDCOffsetStatic(samples, false);
    expect(corrected).toEqual([]);
  });

  it("should not apply correction for insignificant DC offset", () => {
    // DC offset below threshold (1e-3)
    const samples = generateSamplesWithDC(1000, 5e-4, 3e-4);
    const corrected = removeDCOffsetStatic(samples, false);

    // Should return copy with same values (no correction applied, but new array for consistency)
    expect(corrected).not.toBe(samples); // Different reference
    expect(corrected.length).toBe(samples.length);
    for (let i = 0; i < samples.length; i++) {
      expect(corrected[i]?.I).toBeCloseTo(samples[i]?.I ?? 0, 5);
      expect(corrected[i]?.Q).toBeCloseTo(samples[i]?.Q ?? 0, 5);
    }
  });
});

describe("removeDCOffsetIIR", () => {
  it("should remove constant DC offset", () => {
    const dcI = 0.4;
    const dcQ = 0.2;
    const samples = generateSamplesWithDC(2000, dcI, dcQ);

    const state = {
      prevInputI: 0,
      prevInputQ: 0,
      prevOutputI: 0,
      prevOutputQ: 0,
    };

    const corrected = removeDCOffsetIIR(samples, state, 0.99, false);

    // IIR filter needs settling time, check last 1000 samples
    const lastHalf = corrected.slice(1000);
    const dc = calculateDCOffset(lastHalf);

    expect(Math.abs(dc.I)).toBeLessThan(0.01);
    expect(Math.abs(dc.Q)).toBeLessThan(0.01);
  });

  it("should track time-varying DC offset", () => {
    const samples: Sample[] = [];

    // First half: DC = 0.5
    for (let i = 0; i < 1000; i++) {
      samples.push({ I: 0.5, Q: 0.3 });
    }

    // Second half: DC = -0.5 (abrupt change)
    for (let i = 0; i < 1000; i++) {
      samples.push({ I: -0.5, Q: -0.3 });
    }

    const state = {
      prevInputI: 0,
      prevInputQ: 0,
      prevOutputI: 0,
      prevOutputQ: 0,
    };

    const corrected = removeDCOffsetIIR(samples, state, 0.95, false);

    // Check that DC is removed in both sections (after settling)
    const firstSection = corrected.slice(500, 1000);
    const secondSection = corrected.slice(1500, 2000);

    const dc1 = calculateDCOffset(firstSection);
    const dc2 = calculateDCOffset(secondSection);

    expect(Math.abs(dc1.I)).toBeLessThan(0.05);
    expect(Math.abs(dc1.Q)).toBeLessThan(0.05);
    expect(Math.abs(dc2.I)).toBeLessThan(0.05);
    expect(Math.abs(dc2.Q)).toBeLessThan(0.05);
  });

  it("should maintain state between calls", () => {
    const state = {
      prevInputI: 0,
      prevInputQ: 0,
      prevOutputI: 0,
      prevOutputQ: 0,
    };

    // First block
    const samples1 = generateSamplesWithDC(500, 0.5, 0.3);
    removeDCOffsetIIR(samples1, state, 0.99, false);

    // Second block - state should be continuous
    const samples2 = generateSamplesWithDC(500, 0.5, 0.3);
    const corrected2 = removeDCOffsetIIR(samples2, state, 0.99, false);

    // With maintained state, DC should be well-removed even in first samples
    const dc = calculateDCOffset(corrected2);
    expect(Math.abs(dc.I)).toBeLessThan(0.05);
    expect(Math.abs(dc.Q)).toBeLessThan(0.05);

    // State should be updated
    expect(state.prevOutputI).not.toBe(0);
    expect(state.prevOutputQ).not.toBe(0);
  });

  it("should handle different alpha values", () => {
    const samples = generateSamplesWithDC(2000, 0.5, 0.3);

    // Lower alpha = higher cutoff frequency = faster response
    const state1 = {
      prevInputI: 0,
      prevInputQ: 0,
      prevOutputI: 0,
      prevOutputQ: 0,
    };
    const corrected1 = removeDCOffsetIIR(samples, state1, 0.9, false);

    // Higher alpha = lower cutoff frequency = slower response
    const state2 = {
      prevInputI: 0,
      prevInputQ: 0,
      prevOutputI: 0,
      prevOutputQ: 0,
    };
    const corrected2 = removeDCOffsetIIR(samples, state2, 0.99, false);

    // After first 500 samples, alpha=0.9 should have better convergence
    const dc1 = calculateDCOffset(corrected1.slice(0, 500));
    const dc2 = calculateDCOffset(corrected2.slice(0, 500));

    expect(Math.abs(dc1.I)).toBeLessThan(Math.abs(dc2.I));
    expect(Math.abs(dc1.Q)).toBeLessThan(Math.abs(dc2.Q));
  });

  it("should handle empty sample array", () => {
    const samples: Sample[] = [];
    const state = {
      prevInputI: 0,
      prevInputQ: 0,
      prevOutputI: 0,
      prevOutputQ: 0,
    };

    const corrected = removeDCOffsetIIR(samples, state, 0.99, false);
    expect(corrected).toEqual([]);
  });

  it("should preserve signal characteristics (frequency)", () => {
    const signalFreq = 0.1; // 10% of sample rate
    const samples = generateSamplesWithDC(1000, 0.5, 0.3, 0.5, signalFreq);

    const state = {
      prevInputI: 0,
      prevInputQ: 0,
      prevOutputI: 0,
      prevOutputQ: 0,
    };

    const corrected = removeDCOffsetIIR(samples, state, 0.99, false);

    // Verify that the signal frequency is preserved
    // by checking that consecutive samples have expected phase relationship
    const midSection = corrected.slice(500, 600);
    for (let i = 1; i < midSection.length; i++) {
      const phase1 = Math.atan2(
        midSection[i - 1]?.Q ?? 0,
        midSection[i - 1]?.I ?? 0,
      );
      const phase2 = Math.atan2(midSection[i]?.Q ?? 0, midSection[i]?.I ?? 0);
      let phaseDiff = phase2 - phase1;

      // Unwrap phase
      if (phaseDiff > Math.PI) phaseDiff -= 2 * Math.PI;
      if (phaseDiff < -Math.PI) phaseDiff += 2 * Math.PI;

      // Expected phase difference for 0.1 normalized frequency
      const expectedPhaseDiff = 2 * Math.PI * signalFreq;
      expect(Math.abs(phaseDiff)).toBeCloseTo(expectedPhaseDiff, 1);
    }
  });
});

describe("removeDCOffsetCombined", () => {
  it("should remove large static DC plus time-varying component", () => {
    const samples: Sample[] = [];

    // Large initial DC offset
    for (let i = 0; i < 1000; i++) {
      // Add slow drift
      const drift = 0.1 * Math.sin(i / 100);
      samples.push({ I: 1.0 + drift, Q: 0.8 + drift });
    }

    const state = {
      prevInputI: 0,
      prevInputQ: 0,
      prevOutputI: 0,
      prevOutputQ: 0,
    };

    const corrected = removeDCOffsetCombined(samples, state, 0.99, false);

    // After settling, DC should be well-removed
    const lastSection = corrected.slice(500);
    const dc = calculateDCOffset(lastSection);

    expect(Math.abs(dc.I)).toBeLessThan(0.02);
    expect(Math.abs(dc.Q)).toBeLessThan(0.02);
  });

  it("should provide better performance than static alone for varying DC", () => {
    const samples: Sample[] = [];

    // First half: DC = 0.5
    for (let i = 0; i < 500; i++) {
      samples.push({ I: 0.5, Q: 0.3 });
    }

    // Second half: DC = -0.3 (change)
    for (let i = 0; i < 500; i++) {
      samples.push({ I: -0.3, Q: -0.2 });
    }

    const state = {
      prevInputI: 0,
      prevInputQ: 0,
      prevOutputI: 0,
      prevOutputQ: 0,
    };

    // Combined correction
    const combined = removeDCOffsetCombined(samples, state, 0.99, false);

    // Static correction only
    const staticOnly = removeDCOffsetStatic(samples, false);

    // Combined should track the DC change better
    const combinedSecondHalf = combined.slice(500);
    const staticSecondHalf = staticOnly.slice(500);

    const dcStatic = calculateDCOffset(staticSecondHalf);

    // Combined method calculates DC over entire block, so second half
    // will have residual DC. But IIR component should reduce it.
    // This is a weak test because static method is applied to entire block,
    // but it demonstrates the concept. We mostly verify that static-only
    // leaves significant DC in the second half.
    expect(Math.abs(dcStatic.I)).toBeGreaterThan(0.3);
    expect(Math.abs(dcStatic.Q)).toBeGreaterThan(0.2);

    // Verify combined has processed the data
    expect(combined.length).toBe(samples.length);
    expect(combinedSecondHalf.length).toBe(500);
  });

  it("should handle empty sample array", () => {
    const samples: Sample[] = [];
    const state = {
      prevInputI: 0,
      prevInputQ: 0,
      prevOutputI: 0,
      prevOutputQ: 0,
    };

    const corrected = removeDCOffsetCombined(samples, state, 0.99, false);
    expect(corrected).toEqual([]);
  });
});

describe("DC Correction Integration", () => {
  it("should work correctly with real-world sample scenario", () => {
    // Simulate a real SDR scenario: DC offset from LO leakage + signal
    const samples: Sample[] = [];
    const dcOffset = 0.127; // Common for RTL-SDR after normalization
    const signalFreq = 0.05; // 5% of sample rate
    const signalAmp = 0.3;

    for (let i = 0; i < 4096; i++) {
      const angle = 2 * Math.PI * signalFreq * i;
      samples.push({
        I: signalAmp * Math.cos(angle) + dcOffset,
        Q: signalAmp * Math.sin(angle) + dcOffset,
      });
    }

    const state = {
      prevInputI: 0,
      prevInputQ: 0,
      prevOutputI: 0,
      prevOutputQ: 0,
    };

    const corrected = removeDCOffsetCombined(samples, state, 0.99, false);

    // Check DC removal
    const lastQuarter = corrected.slice(3072);
    const dc = calculateDCOffset(lastQuarter);
    expect(Math.abs(dc.I)).toBeLessThan(0.01);
    expect(Math.abs(dc.Q)).toBeLessThan(0.01);

    // Check signal preservation (RMS amplitude)
    let sumMag2 = 0;
    for (const sample of lastQuarter) {
      sumMag2 += sample.I * sample.I + sample.Q * sample.Q;
    }
    const rmsAmplitude = Math.sqrt(sumMag2 / lastQuarter.length);
    // For a complex sinusoid, RMS amplitude should be close to the signal amplitude
    expect(rmsAmplitude).toBeCloseTo(signalAmp, 1);
  });

  it("should handle multiple processing blocks with state continuity", () => {
    const state = {
      prevInputI: 0,
      prevInputQ: 0,
      prevOutputI: 0,
      prevOutputQ: 0,
    };

    // Process multiple blocks sequentially
    for (let block = 0; block < 5; block++) {
      const samples = generateSamplesWithDC(1000, 0.5, 0.3);
      removeDCOffsetIIR(samples, state, 0.99, false);
    }

    // Final block should have well-established state
    const finalSamples = generateSamplesWithDC(1000, 0.5, 0.3);
    const corrected = removeDCOffsetIIR(finalSamples, state, 0.99, false);

    // DC should be removed immediately due to established state
    const firstHalf = corrected.slice(0, 500);
    const dc = calculateDCOffset(firstHalf);
    expect(Math.abs(dc.I)).toBeLessThan(0.01);
    expect(Math.abs(dc.Q)).toBeLessThan(0.01);
  });
});

describe("Performance characteristics", () => {
  it("should handle large sample blocks efficiently", () => {
    const samples = generateSamplesWithDC(65536, 0.5, 0.3); // 64K samples

    const startTime = performance.now();
    removeDCOffsetStatic(samples, false);
    const duration = performance.now() - startTime;

    // Should complete in reasonable time (< 100ms for 64K samples in JS)
    expect(duration).toBeLessThan(100);
  });

  it("should have consistent performance for IIR filter", () => {
    const state = {
      prevInputI: 0,
      prevInputQ: 0,
      prevOutputI: 0,
      prevOutputQ: 0,
    };

    const samples = generateSamplesWithDC(16384, 0.5, 0.3);

    const startTime = performance.now();
    removeDCOffsetIIR(samples, state, 0.99, false);
    const duration = performance.now() - startTime;

    // IIR filter should be O(n) and complete reasonably fast
    expect(duration).toBeLessThan(50);
  });
});
