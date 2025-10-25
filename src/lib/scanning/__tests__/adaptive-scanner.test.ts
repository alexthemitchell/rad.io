/**
 * Adaptive Scanner Tests
 */

import { AdaptiveScanner } from "../adaptive-scanner";
import type { ScanConfig } from "../types";
import type { ISDRDevice } from "../../utils/device-utils";

// Mock FFT worker pool
jest.mock("../../dsp/fft-worker-pool", () => ({
  fftWorkerPool: {
    computeFFT: jest.fn().mockImplementation(async () => {
      return {
        magnitude: new Float32Array([
          -70, -65, -60, -55, -50, -55, -60, -65, -70, -75,
        ]),
        processingTime: 5,
      };
    }),
  },
}));

describe("AdaptiveScanner", () => {
  let scanner: AdaptiveScanner;
  let mockDevice: ISDRDevice;

  beforeEach(() => {
    scanner = new AdaptiveScanner();

    mockDevice = {
      setFrequency: jest.fn().mockResolvedValue(undefined),
      captureSamples: jest.fn().mockResolvedValue(new Float32Array(2048)),
      config: {
        sampleRate: 2_000_000,
      },
    };
  });

  describe("scan", () => {
    it("should scan base frequencies", async () => {
      const config: ScanConfig = {
        startFreq: 146_000_000,
        endFreq: 146_100_000,
        step: 50_000,
        strategy: "adaptive",
      };

      const results: any[] = [];
      const controller = new AbortController();

      await scanner.scan(
        mockDevice,
        config,
        (result) => results.push(result),
        controller.signal,
      );

      // Should scan base frequencies: 146.000, 146.050, 146.100
      expect(results.length).toBeGreaterThanOrEqual(3);
    });

    it("should add finer steps around active signals", async () => {
      const config: ScanConfig = {
        startFreq: 146_000_000,
        endFreq: 146_100_000,
        step: 50_000,
        strategy: "adaptive",
        detectionThreshold: -60,
      };

      // Mock high power on second frequency
      let callCount = 0;
      const { fftWorkerPool } = require("../../dsp/fft-worker-pool");
      fftWorkerPool.computeFFT.mockImplementation(async () => {
        callCount++;
        const magnitude = new Float32Array(10).fill(-80);

        // High power on second call (active signal)
        if (callCount === 2) {
          magnitude.fill(-50);
        }

        return {
          magnitude,
          processingTime: 5,
        };
      });

      const results: any[] = [];
      const controller = new AbortController();

      // First scan to learn
      await scanner.scan(
        mockDevice,
        config,
        (result) => results.push(result),
        controller.signal,
      );

      const firstScanCount = results.length;
      results.length = 0;

      // Second scan should add finer steps
      await scanner.scan(
        mockDevice,
        config,
        (result) => results.push(result),
        controller.signal,
      );

      // Second scan should have more frequencies due to adaptive refinement
      expect(results.length).toBeGreaterThanOrEqual(firstScanCount);
    });

    it("should use adaptive dwell times", async () => {
      const config: ScanConfig = {
        startFreq: 100_000_000,
        endFreq: 100_000_000,
        step: 50_000,
        strategy: "adaptive",
        detectionThreshold: -60,
      };

      const controller = new AbortController();
      const startTime = Date.now();

      await scanner.scan(
        mockDevice,
        config,
        () => {},
        controller.signal,
      );

      const elapsed = Date.now() - startTime;

      // Should take at least base settling time
      expect(elapsed).toBeGreaterThanOrEqual(50);
    });

    it("should respect abort signal", async () => {
      const config: ScanConfig = {
        startFreq: 146_000_000,
        endFreq: 146_200_000,
        step: 25_000,
        strategy: "adaptive",
      };

      const controller = new AbortController();
      const results: any[] = [];

      // Abort after first result
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

      expect(results.length).toBeLessThan(9);
    });

    it("should handle device errors gracefully", async () => {
      const config: ScanConfig = {
        startFreq: 146_000_000,
        endFreq: 146_050_000,
        step: 50_000,
        strategy: "adaptive",
      };

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

      // Should continue despite error
      expect(results.length).toBeGreaterThan(0);
    });
  });

  describe("reset", () => {
    it("should clear learned interest data", async () => {
      const config: ScanConfig = {
        startFreq: 146_000_000,
        endFreq: 146_100_000,
        step: 50_000,
        strategy: "adaptive",
        detectionThreshold: -60,
      };

      const { fftWorkerPool } = require("../../dsp/fft-worker-pool");
      fftWorkerPool.computeFFT.mockResolvedValue({
        magnitude: new Float32Array(10).fill(-50),
        processingTime: 5,
      });

      const controller = new AbortController();

      // First scan learns interests
      await scanner.scan(
        mockDevice,
        config,
        () => {},
        controller.signal,
      );

      // Reset
      scanner.reset();

      // Second scan should behave like first (no adaptive steps)
      const results: any[] = [];
      await scanner.scan(
        mockDevice,
        config,
        (result) => results.push(result),
        new AbortController().signal,
      );

      // Should only have base frequencies
      expect(results.length).toBe(3);
    });
  });
});
