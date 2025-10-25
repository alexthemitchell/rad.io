/**
 * Noise Floor Estimator Tests
 */

import { NoiseFloorEstimator } from "../noise-floor";

describe("NoiseFloorEstimator", () => {
  let estimator: NoiseFloorEstimator;

  beforeEach(() => {
    estimator = new NoiseFloorEstimator(10);
  });

  describe("estimate", () => {
    it("should estimate noise floor from a single spectrum", () => {
      const spectrum = new Float32Array([
        -80, -79, -78, -77, -76, -75, -74, -73, -72, -71,
      ]);

      const noiseFloor = estimator.estimate(spectrum);

      // Should return lower quartile value
      expect(noiseFloor).toBeGreaterThan(-81);
      expect(noiseFloor).toBeLessThan(-70);
    });

    it("should build history over multiple estimates", () => {
      const spectrum1 = new Float32Array([
        -80, -79, -78, -77, -76, -75, -74, -73, -72, -71,
      ]);
      const spectrum2 = new Float32Array([
        -81, -80, -79, -78, -77, -76, -75, -74, -73, -72,
      ]);

      estimator.estimate(spectrum1);
      expect(estimator.getHistoryLength()).toBe(1);

      estimator.estimate(spectrum2);
      expect(estimator.getHistoryLength()).toBe(2);
    });

    it("should limit history to configured size", () => {
      const spectrum = new Float32Array(10).fill(-75);

      // Add more spectra than history size
      for (let i = 0; i < 15; i++) {
        estimator.estimate(spectrum);
      }

      expect(estimator.getHistoryLength()).toBe(10);
    });

    it("should be resistant to strong signals", () => {
      const spectrum = new Float32Array(100);

      // Mostly noise at -80 dB
      for (let i = 0; i < 100; i++) {
        spectrum[i] = -80 + Math.random() * 2;
      }

      // Add a few strong signals
      spectrum[25] = -20;
      spectrum[50] = -15;
      spectrum[75] = -25;

      const noiseFloor = estimator.estimate(spectrum);

      // Should still estimate noise floor around -80, not affected by signals
      expect(noiseFloor).toBeGreaterThan(-82);
      expect(noiseFloor).toBeLessThan(-75);
    });

    it("should handle empty spectrum", () => {
      const spectrum = new Float32Array(0);
      const noiseFloor = estimator.estimate(spectrum);
      expect(isNaN(noiseFloor)).toBe(true);
    });
  });

  describe("reset", () => {
    it("should clear history", () => {
      const spectrum = new Float32Array(10).fill(-75);

      estimator.estimate(spectrum);
      estimator.estimate(spectrum);
      expect(estimator.getHistoryLength()).toBe(2);

      estimator.reset();
      expect(estimator.getHistoryLength()).toBe(0);
    });
  });

  describe("getHistoryLength", () => {
    it("should return 0 initially", () => {
      expect(estimator.getHistoryLength()).toBe(0);
    });

    it("should return current history count", () => {
      const spectrum = new Float32Array(10).fill(-75);

      estimator.estimate(spectrum);
      expect(estimator.getHistoryLength()).toBe(1);

      estimator.estimate(spectrum);
      expect(estimator.getHistoryLength()).toBe(2);
    });
  });
});
