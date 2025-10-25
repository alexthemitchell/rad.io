/**
 * PriorityScanner Tests
 */

import { PriorityScanner } from "../priority-scanner";
import type { ScanConfig } from "../types";
import type { ISDRDevice } from "../../utils/device-utils";

// Mock FFT worker pool
jest.mock("../../dsp/fft-worker-pool", () => ({
  fftWorkerPool: {
    computeFFT: jest.fn().mockResolvedValue({
      magnitude: new Float32Array([
        -70, -65, -60, -55, -50, -55, -60, -65, -70, -75,
      ]),
      processingTime: 5,
    }),
  },
}));

// Mock LinearScanner
jest.mock("../linear-scanner", () => ({
  LinearScanner: jest.fn().mockImplementation(() => ({
    scan: jest.fn().mockImplementation(async (device, config) => {
      // Simulate calling setFrequency
      if (device.setFrequency) {
        await device.setFrequency(config.startFreq);
      }

      return [
        {
          frequency: 146_025_000,
          timestamp: Date.now(),
          powerSpectrum: new Float32Array(10),
          peakPower: -60,
          avgPower: -65,
        },
      ];
    }),
  })),
}));

describe("PriorityScanner", () => {
  let scanner: PriorityScanner;
  let mockDevice: ISDRDevice;

  beforeEach(() => {
    scanner = new PriorityScanner();

    mockDevice = {
      setFrequency: jest.fn().mockResolvedValue(undefined),
      captureSamples: jest.fn().mockResolvedValue(new Float32Array(2048)),
      config: {
        sampleRate: 2_000_000,
      },
    };
  });

  describe("scan", () => {
    it("should scan priority frequencies first", async () => {
      const config: ScanConfig = {
        startFreq: 146_000_000,
        endFreq: 146_100_000,
        step: 25_000,
        strategy: "priority",
        priorityFrequencies: [146_000_000, 146_050_000],
      };

      const results: any[] = [];
      const controller = new AbortController();

      await scanner.scan(
        mockDevice,
        config,
        (result) => results.push(result),
        controller.signal,
      );

      // Should have scanned priority frequencies first
      expect(mockDevice.setFrequency).toHaveBeenCalledWith(146_000_000);
      expect(mockDevice.setFrequency).toHaveBeenCalledWith(146_050_000);

      // Should have at least 2 results (priority frequencies)
      expect(results.length).toBeGreaterThanOrEqual(2);
    });

    it("should skip priority frequencies outside scan range", async () => {
      const config: ScanConfig = {
        startFreq: 146_000_000,
        endFreq: 146_100_000,
        step: 25_000,
        strategy: "priority",
        priorityFrequencies: [145_000_000, 147_000_000], // Outside range
      };

      const results: any[] = [];
      const controller = new AbortController();

      await scanner.scan(
        mockDevice,
        config,
        (result) => results.push(result),
        controller.signal,
      );

      // Should not have called setFrequency for out-of-range frequencies
      expect(mockDevice.setFrequency).not.toHaveBeenCalledWith(145_000_000);
      expect(mockDevice.setFrequency).not.toHaveBeenCalledWith(147_000_000);
    });

    it("should handle empty priority list", async () => {
      const config: ScanConfig = {
        startFreq: 146_000_000,
        endFreq: 146_100_000,
        step: 25_000,
        strategy: "priority",
        priorityFrequencies: [],
      };

      const controller = new AbortController();

      await scanner.scan(mockDevice, config, () => {}, controller.signal);

      // Should still complete scan using linear scanner
      expect(mockDevice.setFrequency).toHaveBeenCalled();
    });

    it("should handle missing priority list", async () => {
      const config: ScanConfig = {
        startFreq: 146_000_000,
        endFreq: 146_100_000,
        step: 25_000,
        strategy: "priority",
      };

      const controller = new AbortController();

      await scanner.scan(mockDevice, config, () => {}, controller.signal);

      // Should complete without errors
      expect(mockDevice.setFrequency).toHaveBeenCalled();
    });

    it("should abort early if signal aborted during priority scan", async () => {
      const config: ScanConfig = {
        startFreq: 146_000_000,
        endFreq: 146_100_000,
        step: 25_000,
        strategy: "priority",
        priorityFrequencies: [146_000_000, 146_050_000, 146_075_000],
      };

      const controller = new AbortController();
      const results: any[] = [];

      // Abort after first priority frequency
      mockDevice.setFrequency = jest.fn().mockImplementation(async () => {
        if (results.length >= 1) {
          controller.abort();
        }
      });

      await scanner.scan(
        mockDevice,
        config,
        (result) => results.push(result),
        controller.signal,
      );

      // Should have stopped early
      expect(results.length).toBeLessThan(3);
    });

    it("should handle errors during priority frequency scan", async () => {
      const config: ScanConfig = {
        startFreq: 146_000_000,
        endFreq: 146_100_000,
        step: 25_000,
        strategy: "priority",
        priorityFrequencies: [146_000_000, 146_050_000],
      };

      const consoleErrorSpy = jest.spyOn(console, "error").mockImplementation();

      // Make setFrequency fail on second call
      mockDevice.setFrequency = jest
        .fn()
        .mockResolvedValueOnce(undefined)
        .mockRejectedValueOnce(new Error("Device error"));

      const results: any[] = [];
      const controller = new AbortController();

      await scanner.scan(
        mockDevice,
        config,
        (result) => results.push(result),
        controller.signal,
      );

      // Should have logged error
      expect(consoleErrorSpy).toHaveBeenCalled();

      // Should still complete with successful scans
      expect(results.length).toBeGreaterThan(0);

      consoleErrorSpy.mockRestore();
    });

    it("should not duplicate frequencies already scanned", async () => {
      const config: ScanConfig = {
        startFreq: 146_000_000,
        endFreq: 146_050_000,
        step: 25_000,
        strategy: "priority",
        priorityFrequencies: [146_000_000], // First frequency in range
      };

      const results: any[] = [];
      const controller = new AbortController();

      await scanner.scan(
        mockDevice,
        config,
        (result) => results.push(result),
        controller.signal,
      );

      // Check that 146_000_000 appears only once
      const freq146M = results.filter((r) => r.frequency === 146_000_000);
      expect(freq146M.length).toBe(1);
    });

    it("should use custom settling time and sample count", async () => {
      const config: ScanConfig = {
        startFreq: 146_000_000,
        endFreq: 146_000_000,
        step: 25_000,
        strategy: "priority",
        priorityFrequencies: [146_000_000],
        settlingTime: 100,
        sampleCount: 4096,
      };

      const controller = new AbortController();
      const startTime = Date.now();

      await scanner.scan(mockDevice, config, () => {}, controller.signal);

      const elapsed = Date.now() - startTime;

      // Should take at least the settling time
      expect(elapsed).toBeGreaterThanOrEqual(100);

      // Should use custom sample count
      expect(mockDevice.captureSamples).toHaveBeenCalledWith(4096);
    });
  });
});
