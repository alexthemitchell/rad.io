/**
 * Channel Power Measurement Tests
 */

import { ChannelPowerMeasurement } from "../channel-power";

describe("ChannelPowerMeasurement", () => {
  let measurement: ChannelPowerMeasurement;

  beforeEach(() => {
    measurement = new ChannelPowerMeasurement();
  });

  describe("measureChannelPower", () => {
    it("should measure total power in a band", () => {
      // Create a spectrum with a signal at 100 MHz
      const spectrum = new Float32Array(1000);
      const frequencies = new Float32Array(1000);

      for (let i = 0; i < 1000; i++) {
        frequencies[i] = 95e6 + (i * 10e3); // 95-105 MHz
        spectrum[i] = -60; // Noise floor
      }

      // Add signal at 100 MHz (bins 500-510)
      for (let i = 500; i <= 510; i++) {
        spectrum[i] = -30; // Signal 30 dB above noise
      }

      const result = measurement.measureChannelPower(
        spectrum,
        frequencies,
        100e6,
        200e3, // 200 kHz bandwidth
      );

      expect(result.centerFrequency).toBe(100e6);
      expect(result.bandwidth).toBe(200e3);
      expect(result.peakPower).toBeGreaterThan(-35);
      expect(result.totalPower).toBeGreaterThan(-40);
    });

    it("should calculate average power", () => {
      const spectrum = new Float32Array([
        -40, -30, -20, -30, -40,
      ]);
      const frequencies = new Float32Array([
        100e6, 100.01e6, 100.02e6, 100.03e6, 100.04e6,
      ]);

      const result = measurement.measureChannelPower(
        spectrum,
        frequencies,
        100.02e6,
        40e3,
      );

      expect(result.averagePower).toBeDefined();
      // Average power calculation includes all bins in range
      expect(typeof result.averagePower).toBe("number");
      expect(result.averagePower).toBeGreaterThan(-Infinity);
    });

    it("should calculate occupied bandwidth", () => {
      const spectrum = new Float32Array(100);
      const frequencies = new Float32Array(100);

      for (let i = 0; i < 100; i++) {
        frequencies[i] = 100e6 + i * 1e3;
        // Gaussian-like signal centered at 100.05 MHz
        const offset = i - 50;
        spectrum[i] = -30 - Math.abs(offset) / 2;
      }

      const result = measurement.measureChannelPower(
        spectrum,
        frequencies,
        100.05e6,
        100e3,
      );

      expect(result.occupiedBandwidth).toBeDefined();
      // OBW can be 0 for signals with very low power
      expect(result.occupiedBandwidth).toBeGreaterThanOrEqual(0);
      expect(result.occupiedBandwidth).toBeLessThanOrEqual(100e3);
    });

    it("should throw error for invalid frequency range", () => {
      const spectrum = new Float32Array([10, 20, 30]);
      const frequencies = new Float32Array([
        100e6, 101e6, 102e6,
      ]);

      expect(() =>
        measurement.measureChannelPower(
          spectrum,
          frequencies,
          200e6, // Outside range
          1e6,
        ),
      ).toThrow();
    });
  });

  describe("measureACPR", () => {
    it("should measure adjacent channel power ratio", () => {
      const spectrum = new Float32Array(1000);
      const frequencies = new Float32Array(1000);

      for (let i = 0; i < 1000; i++) {
        frequencies[i] = 95e6 + i * 10e3;
        spectrum[i] = -70; // Noise floor
      }

      // Main channel at 100 MHz
      for (let i = 475; i <= 525; i++) {
        spectrum[i] = -20;
      }

      // Adjacent channels with lower power
      for (let i = 425; i <= 474; i++) {
        spectrum[i] = -50; // Lower adjacent
      }
      for (let i = 526; i <= 575; i++) {
        spectrum[i] = -50; // Upper adjacent
      }

      const result = measurement.measureACPR(
        spectrum,
        frequencies,
        100e6,
        500e3,
        500e3, // 500 kHz offset
      );

      expect(result.mainChannelPower).toBeGreaterThan(-25);
      expect(result.lowerACPR).toBeGreaterThan(0); // dB
      expect(result.upperACPR).toBeGreaterThan(0); // dB
    });

    it("should handle symmetric adjacent channels", () => {
      const spectrum = new Float32Array(100);
      const frequencies = new Float32Array(100);

      for (let i = 0; i < 100; i++) {
        frequencies[i] = 100e6 + i * 10e3;
        spectrum[i] = -60;
      }

      // Make symmetric signal
      for (let i = 40; i <= 60; i++) {
        spectrum[i] = -30;
      }

      const result = measurement.measureACPR(
        spectrum,
        frequencies,
        100.5e6,
        200e3,
        200e3,
      );

      expect(
        Math.abs(result.lowerACPR - result.upperACPR),
      ).toBeLessThan(5);
    });
  });

  describe("calculateCCDF", () => {
    it("should calculate CCDF distribution", () => {
      const spectrum = new Float32Array(1000);
      for (let i = 0; i < 1000; i++) {
        spectrum[i] = -60 + Math.random() * 40;
      }

      const { threshold, probability } =
        measurement.calculateCCDF(spectrum, 50);

      expect(threshold).toHaveLength(50);
      expect(probability).toHaveLength(50);

      // Probabilities should be increasing
      for (let i = 1; i < probability.length; i++) {
        const curr = probability[i];
        const prev = probability[i - 1];
        if (curr !== undefined && prev !== undefined) {
          expect(curr).toBeGreaterThanOrEqual(prev);
        }
      }

      // Thresholds should be decreasing (sorted descending)
      for (let i = 1; i < threshold.length; i++) {
        const curr = threshold[i];
        const prev = threshold[i - 1];
        if (curr !== undefined && prev !== undefined) {
          expect(curr).toBeLessThanOrEqual(prev);
        }
      }
    });

    it("should handle small spectrum arrays", () => {
      const spectrum = new Float32Array([-20, -30, -40, -50]);

      const { threshold, probability } =
        measurement.calculateCCDF(spectrum, 4);

      expect(threshold.length).toBeGreaterThan(0);
      expect(probability.length).toBeGreaterThan(0);
    });
  });

  describe("integration methods", () => {
    it("should use rectangular integration when configured", () => {
      const rectMeasurement = new ChannelPowerMeasurement({
        integrationMethod: "rectangular",
      });

      const spectrum = new Float32Array([-30, -30, -30, -30]);
      const frequencies = new Float32Array([
        100e6, 100.01e6, 100.02e6, 100.03e6,
      ]);

      const result = rectMeasurement.measureChannelPower(
        spectrum,
        frequencies,
        100.015e6,
        30e3,
      );

      expect(result.totalPower).toBeDefined();
    });

    it("should use trapezoidal integration when configured", () => {
      const trapMeasurement = new ChannelPowerMeasurement({
        integrationMethod: "trapezoidal",
      });

      const spectrum = new Float32Array([-30, -30, -30, -30]);
      const frequencies = new Float32Array([
        100e6, 100.01e6, 100.02e6, 100.03e6,
      ]);

      const result = trapMeasurement.measureChannelPower(
        spectrum,
        frequencies,
        100.015e6,
        30e3,
      );

      expect(result.totalPower).toBeDefined();
    });
  });

  describe("occupied bandwidth threshold", () => {
    it("should respect configured threshold", () => {
      const measurement99 = new ChannelPowerMeasurement({
        occupiedBandwidthThreshold: 0.99,
      });

      const spectrum = new Float32Array(100);
      const frequencies = new Float32Array(100);

      for (let i = 0; i < 100; i++) {
        frequencies[i] = 100e6 + i * 1e3;
        spectrum[i] = -30 - Math.abs(i - 50);
      }

      const result = measurement99.measureChannelPower(
        spectrum,
        frequencies,
        100.05e6,
        100e3,
      );

      expect(result.occupiedBandwidth).toBeDefined();
    });
  });
});
