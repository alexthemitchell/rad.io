/**
 * Linear Scanner Tests
 */

import { LinearScanner } from "../linear-scanner";
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

describe("LinearScanner", () => {
  let scanner: LinearScanner;
  let mockDevice: ISDRDevice;

  beforeEach(() => {
    scanner = new LinearScanner();

    mockDevice = {
      setFrequency: jest.fn().mockResolvedValue(undefined),
      captureSamples: jest.fn().mockResolvedValue(new Float32Array(2048)),
      config: {
        sampleRate: 2_000_000,
      },
    };
  });

  describe("scan", () => {
    it("should scan all frequencies in range", async () => {
      const config: ScanConfig = {
        startFreq: 146_000_000,
        endFreq: 146_100_000,
        step: 25_000,
        strategy: "linear",
      };

      const results: any[] = [];
      const controller = new AbortController();

      await scanner.scan(
        mockDevice,
        config,
        (result) => results.push(result),
        controller.signal,
      );

      // Should scan 5 frequencies: 146.000, 146.025, 146.050, 146.075, 146.100
      expect(results.length).toBe(5);
      expect(mockDevice.setFrequency).toHaveBeenCalledTimes(5);
    });

    it("should call setFrequency with correct frequencies", async () => {
      const config: ScanConfig = {
        startFreq: 100_000_000,
        endFreq: 100_050_000,
        step: 25_000,
        strategy: "linear",
      };

      const controller = new AbortController();

      await scanner.scan(
        mockDevice,
        config,
        () => {},
        controller.signal,
      );

      expect(mockDevice.setFrequency).toHaveBeenCalledWith(100_000_000);
      expect(mockDevice.setFrequency).toHaveBeenCalledWith(100_025_000);
      expect(mockDevice.setFrequency).toHaveBeenCalledWith(100_050_000);
    });

    it("should report progress for each frequency", async () => {
      const config: ScanConfig = {
        startFreq: 146_000_000,
        endFreq: 146_050_000,
        step: 25_000,
        strategy: "linear",
      };

      const progressReports: any[] = [];
      const controller = new AbortController();

      await scanner.scan(
        mockDevice,
        config,
        (result) => progressReports.push(result),
        controller.signal,
      );

      expect(progressReports.length).toBe(3);
      expect(progressReports[0].frequency).toBe(146_000_000);
      expect(progressReports[1].frequency).toBe(146_025_000);
      expect(progressReports[2].frequency).toBe(146_050_000);
    });

    it("should include power spectrum in results", async () => {
      const config: ScanConfig = {
        startFreq: 100_000_000,
        endFreq: 100_000_000,
        step: 25_000,
        strategy: "linear",
      };

      const results: any[] = [];
      const controller = new AbortController();

      await scanner.scan(
        mockDevice,
        config,
        (result) => results.push(result),
        controller.signal,
      );

      expect(results.length).toBe(1);
      expect(results[0].powerSpectrum).toBeInstanceOf(Float32Array);
      expect(results[0].peakPower).toBeDefined();
      expect(results[0].avgPower).toBeDefined();
    });

    it("should stop scanning when aborted", async () => {
      const config: ScanConfig = {
        startFreq: 146_000_000,
        endFreq: 146_100_000,
        step: 25_000,
        strategy: "linear",
      };

      const controller = new AbortController();
      const results: any[] = [];

      // Abort after first frequency
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

      // Should have scanned fewer than all frequencies
      expect(results.length).toBeLessThan(5);
    });

    it("should use custom settling time if provided", async () => {
      const config: ScanConfig = {
        startFreq: 100_000_000,
        endFreq: 100_000_000,
        step: 25_000,
        strategy: "linear",
        settlingTime: 100,
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

      // Should take at least the settling time
      expect(elapsed).toBeGreaterThanOrEqual(100);
    });

    it("should handle device errors gracefully", async () => {
      const config: ScanConfig = {
        startFreq: 146_000_000,
        endFreq: 146_050_000,
        step: 25_000,
        strategy: "linear",
      };

      // Make setFrequency fail on second call
      mockDevice.setFrequency = jest
        .fn()
        .mockResolvedValueOnce(undefined)
        .mockRejectedValueOnce(new Error("Device error"))
        .mockResolvedValueOnce(undefined);

      const results: any[] = [];
      const controller = new AbortController();

      await scanner.scan(
        mockDevice,
        config,
        (result) => results.push(result),
        controller.signal,
      );

      // Should continue scanning despite error
      // Results should only include successful scans
      expect(results.length).toBeLessThan(3);
    });

    it("should use custom sample count if provided", async () => {
      const config: ScanConfig = {
        startFreq: 100_000_000,
        endFreq: 100_000_000,
        step: 25_000,
        strategy: "linear",
        sampleCount: 4096,
      };

      const controller = new AbortController();

      await scanner.scan(
        mockDevice,
        config,
        () => {},
        controller.signal,
      );

      expect(mockDevice.captureSamples).toHaveBeenCalledWith(4096);
    });
  });
});
