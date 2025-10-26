/**
 * Tests for SimulatedSource
 */

import { SimulatedSource } from "../SimulatedSource";
import type { Sample } from "../../utils/dsp";

describe("SimulatedSource", () => {
  let source: SimulatedSource;

  beforeEach(() => {
    jest.useFakeTimers();
    source = new SimulatedSource();
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  describe("initialization", () => {
    it("should create with default configuration", () => {
      const metadata = source.getMetadata();
      expect(metadata.name).toBe("Simulated Source");
      expect(metadata.sampleRate).toBe(2048000);
      expect(metadata.centerFrequency).toBe(100000000);
    });

    it("should create with custom configuration", () => {
      const customSource = new SimulatedSource({
        sampleRate: 1000000,
        centerFrequency: 50000000,
        pattern: "qpsk",
      });

      const metadata = customSource.getMetadata();
      expect(metadata.sampleRate).toBe(1000000);
      expect(metadata.centerFrequency).toBe(50000000);
      expect(metadata["pattern"]).toBe("qpsk");
    });

    it("should not be streaming initially", () => {
      expect(source.isStreaming()).toBe(false);
    });
  });

  describe("streaming", () => {
    it("should start streaming and call callback with samples", async () => {
      const callback = jest.fn();

      await source.startStreaming(callback);
      expect(source.isStreaming()).toBe(true);

      // Fast-forward time to trigger sample generation
      jest.advanceTimersByTime(50);

      expect(callback).toHaveBeenCalled();
      const samples = callback.mock.calls[0][0] as Sample[];
      expect(samples).toBeInstanceOf(Array);
      expect(samples.length).toBe(2048); // Default samplesPerUpdate

      await source.stopStreaming();
    });

    it("should generate multiple batches over time", async () => {
      const callback = jest.fn();

      await source.startStreaming(callback);

      // Generate 3 batches
      jest.advanceTimersByTime(150);

      expect(callback).toHaveBeenCalledTimes(3);

      await source.stopStreaming();
    });

    it("should stop streaming when requested", async () => {
      const callback = jest.fn();

      await source.startStreaming(callback);
      expect(source.isStreaming()).toBe(true);

      await source.stopStreaming();
      expect(source.isStreaming()).toBe(false);

      // Verify no more callbacks after stopping
      callback.mockClear();
      jest.advanceTimersByTime(100);
      expect(callback).not.toHaveBeenCalled();
    });

    it("should not start streaming if already streaming", async () => {
      const callback1 = jest.fn();
      const callback2 = jest.fn();

      await source.startStreaming(callback1);
      await source.startStreaming(callback2);

      jest.advanceTimersByTime(50);

      // Should only call the first callback
      expect(callback1).toHaveBeenCalled();
      expect(callback2).not.toHaveBeenCalled();

      await source.stopStreaming();
    });
  });

  describe("sample generation patterns", () => {
    it("should generate sine wave pattern", async () => {
      const customSource = new SimulatedSource({
        pattern: "sine",
        samplesPerUpdate: 100,
      });

      const callback = jest.fn();
      await customSource.startStreaming(callback);
      jest.advanceTimersByTime(50);

      const samples = callback.mock.calls[0][0] as Sample[];
      expect(samples.length).toBe(100);

      // Verify sine wave characteristics
      const magnitudes = samples.map((s) => Math.sqrt(s.I * s.I + s.Q * s.Q));
      const avgMagnitude =
        magnitudes.reduce((a, b) => a + b, 0) / magnitudes.length;
      expect(avgMagnitude).toBeGreaterThan(0.5);
      expect(avgMagnitude).toBeLessThan(1.0);

      await customSource.stopStreaming();
    });

    it("should generate QPSK pattern", async () => {
      const customSource = new SimulatedSource({
        pattern: "qpsk",
        samplesPerUpdate: 100,
        amplitude: 0.7,
      });

      const callback = jest.fn();
      await customSource.startStreaming(callback);
      jest.advanceTimersByTime(50);

      const samples = callback.mock.calls[0][0] as Sample[];
      expect(samples.length).toBe(100);

      // QPSK should have 4 distinct points
      const uniquePoints = new Set(
        samples.map((s) => `${s.I.toFixed(2)},${s.Q.toFixed(2)}`),
      );
      expect(uniquePoints.size).toBeLessThanOrEqual(4);

      await customSource.stopStreaming();
    });

    it("should generate noise pattern", async () => {
      const customSource = new SimulatedSource({
        pattern: "noise",
        samplesPerUpdate: 100,
      });

      const callback = jest.fn();
      await customSource.startStreaming(callback);
      jest.advanceTimersByTime(50);

      const samples = callback.mock.calls[0][0] as Sample[];
      expect(samples.length).toBe(100);

      // Noise should have high variance
      const iValues = samples.map((s) => s.I);
      const qValues = samples.map((s) => s.Q);
      const iVariance =
        iValues.reduce((sum, val) => sum + val * val, 0) / iValues.length;
      const qVariance =
        qValues.reduce((sum, val) => sum + val * val, 0) / qValues.length;

      expect(iVariance).toBeGreaterThan(0.1);
      expect(qVariance).toBeGreaterThan(0.1);

      await customSource.stopStreaming();
    });

    it("should generate FM pattern", async () => {
      const customSource = new SimulatedSource({
        pattern: "fm",
        samplesPerUpdate: 100,
      });

      const callback = jest.fn();
      await customSource.startStreaming(callback);
      jest.advanceTimersByTime(50);

      const samples = callback.mock.calls[0][0] as Sample[];
      expect(samples.length).toBe(100);

      // FM should maintain constant magnitude
      const magnitudes = samples.map((s) => Math.sqrt(s.I * s.I + s.Q * s.Q));
      const avgMagnitude =
        magnitudes.reduce((a, b) => a + b, 0) / magnitudes.length;
      expect(avgMagnitude).toBeGreaterThan(0.5);

      await customSource.stopStreaming();
    });

    it("should generate multi-tone pattern", async () => {
      const customSource = new SimulatedSource({
        pattern: "multi-tone",
        samplesPerUpdate: 100,
      });

      const callback = jest.fn();
      await customSource.startStreaming(callback);
      jest.advanceTimersByTime(50);

      const samples = callback.mock.calls[0][0] as Sample[];
      expect(samples.length).toBe(100);

      // Multi-tone should have varying amplitude
      const magnitudes = samples.map((s) => Math.sqrt(s.I * s.I + s.Q * s.Q));
      const minMag = Math.min(...magnitudes);
      const maxMag = Math.max(...magnitudes);
      expect(maxMag - minMag).toBeGreaterThan(0.05);

      await customSource.stopStreaming();
    });
  });

  describe("configuration updates", () => {
    it("should update configuration", () => {
      source.updateConfig({ pattern: "qpsk", amplitude: 0.5 });

      const config = source.getConfig();
      expect(config.pattern).toBe("qpsk");
      expect(config.amplitude).toBe(0.5);
    });

    it("should restart streaming with new config if already streaming", async () => {
      const callback = jest.fn();
      await source.startStreaming(callback);

      source.updateConfig({ samplesPerUpdate: 500 });

      jest.advanceTimersByTime(50);

      const samples = callback.mock.calls[0][0] as Sample[];
      expect(samples.length).toBe(500);

      await source.stopStreaming();
    });
  });
});
