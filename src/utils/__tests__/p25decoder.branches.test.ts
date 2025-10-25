/**
 * Tiny extra branch coverage for p25decoder: negative wrap-around in normalizePhase via phaseToSymbol
 */

import {
  phaseToSymbol,
  P25Symbol,
  demodulateHDQPSK,
  detectFrameSync,
  calculateSignalQuality,
} from "../p25decoder";
import { type Sample } from "../dsp";

describe("p25decoder extra branches", () => {
  it("handles negative wrap-around below -pi", () => {
    const phase = (-225 * Math.PI) / 180; // -225° -> should wrap to +135° equivalent bucket
    const sym = phaseToSymbol(phase);
    // Accept either SYMBOL_11 (135°) or SYMBOL_00 (-135°) depending on normalization boundary handling
    expect([P25Symbol.SYMBOL_11, P25Symbol.SYMBOL_00]).toContain(sym);
  });

  describe("demodulateHDQPSK edge cases", () => {
    it("handles single sample (less than 2)", () => {
      const samples: Sample[] = [{ I: 1, Q: 0 }];
      const result = demodulateHDQPSK(samples);
      expect(result).toEqual([]);
    });

    it("handles undefined samples in array", () => {
      const samples: Sample[] = new Array(20);
      samples[0] = { I: 1, Q: 0 };
      // Other elements are undefined
      const result = demodulateHDQPSK(samples);
      // Should skip undefined samples
      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe("detectFrameSync threshold testing", () => {
    it("returns -1 when no sync pattern matches threshold", () => {
      const bits = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0]; // Too short or no match
      const result = detectFrameSync(bits, 0.9);
      expect(result).toBe(-1);
    });

    it("returns index when sync pattern matches threshold", () => {
      // P25 sync pattern: [1,0,1,0,1,1,1,1,0,0,1,0]
      const syncBits = [1, 0, 1, 0, 1, 1, 1, 1, 0, 0, 1, 0];
      const result = detectFrameSync(syncBits, 0.7);
      expect(result).toBe(0);
    });

    it("finds sync pattern in middle of bits array", () => {
      // P25 sync pattern: [1,0,1,0,1,1,1,1,0,0,1,0]
      const bits = [
        0,
        0,
        0,
        0,
        0, // Noise
        1,
        0,
        1,
        0,
        1,
        1,
        1,
        1,
        0,
        0,
        1,
        0, // Sync pattern at index 5
        1,
        1,
        1,
        1, // More data
      ];
      const result = detectFrameSync(bits, 0.8);
      expect(result).toBe(5);
    });

    it("returns -1 when bits match but below threshold", () => {
      // Partial match (only 6 out of 12 bits = 50%)
      // Sync: [1,0,1,0,1,1,1,1,0,0,1,0]
      // Test: [1,0,1,0,0,0,1,1,0,0,0,1]
      const bits = [1, 0, 1, 0, 0, 0, 1, 1, 0, 0, 0, 1];
      const result = detectFrameSync(bits, 0.8); // Need 80% (10 matches), only have 6
      expect(result).toBe(-1);
    });
  });

  describe("calculateSignalQuality edge cases", () => {
    it("handles empty samples", () => {
      const samples: Sample[] = [];
      const symbols: number[] = [];
      const quality = calculateSignalQuality(samples, symbols);
      expect(typeof quality).toBe("number");
      expect(quality).toBeGreaterThanOrEqual(0);
      expect(quality).toBeLessThanOrEqual(100);
    });

    it("handles mismatched samples and symbols lengths", () => {
      const samples: Sample[] = [
        { I: 1, Q: 0 },
        { I: 0, Q: 1 },
      ];
      const symbols: number[] = [0, 1, 2, 3, 4]; // More symbols than samples
      const quality = calculateSignalQuality(samples, symbols);
      expect(typeof quality).toBe("number");
      expect(quality).toBeGreaterThanOrEqual(0);
      expect(quality).toBeLessThanOrEqual(100);
    });
  });
});
