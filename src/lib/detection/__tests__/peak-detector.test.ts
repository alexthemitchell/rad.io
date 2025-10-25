/**
 * Peak Detector Tests
 */

import { PeakDetector } from "../peak-detector";

describe("PeakDetector", () => {
  let detector: PeakDetector;

  beforeEach(() => {
    detector = new PeakDetector(10, 1000, 1_000_000);
  });

  describe("detect", () => {
    it("should detect a single peak above threshold", () => {
      const spectrum = new Float32Array(100);
      const noiseFloor = -80;
      const sampleRate = 2_000_000;
      const centerFreq = 100_000_000;

      // Fill with noise
      spectrum.fill(noiseFloor);

      // Add a peak at bin 50
      for (let i = 45; i <= 55; i++) {
        spectrum[i] = -60; // 20 dB above noise floor
      }

      const peaks = detector.detect(
        spectrum,
        noiseFloor,
        sampleRate,
        centerFreq,
      );

      expect(peaks.length).toBe(1);
      expect(peaks[0]!.binIndex).toBeGreaterThanOrEqual(45);
      expect(peaks[0]!.binIndex).toBeLessThanOrEqual(55);
      expect(peaks[0]!.power).toBeCloseTo(-60, 1);
      expect(peaks[0]!.snr).toBeCloseTo(20, 1);
    });

    it("should detect multiple peaks", () => {
      const spectrum = new Float32Array(1000);
      const noiseFloor = -80;
      const sampleRate = 2_000_000;
      const centerFreq = 100_000_000;

      // Fill with noise
      spectrum.fill(noiseFloor);

      // Add three distinct peaks
      for (let i = 100; i <= 110; i++) spectrum[i] = -60;
      for (let i = 300; i <= 320; i++) spectrum[i] = -55;
      for (let i = 700; i <= 730; i++) spectrum[i] = -50;

      const peaks = detector.detect(
        spectrum,
        noiseFloor,
        sampleRate,
        centerFreq,
      );

      expect(peaks.length).toBe(3);
      expect(peaks[0]!.snr).toBeCloseTo(20, 1);
      expect(peaks[1]!.snr).toBeCloseTo(25, 1);
      expect(peaks[2]!.snr).toBeCloseTo(30, 1);
    });

    it("should not detect signals below threshold", () => {
      const spectrum = new Float32Array(100);
      const noiseFloor = -80;
      const sampleRate = 2_000_000;
      const centerFreq = 100_000_000;

      // Fill with noise
      spectrum.fill(noiseFloor);

      // Add a weak peak (only 5 dB above noise, below 10 dB threshold)
      for (let i = 45; i <= 55; i++) {
        spectrum[i] = -75;
      }

      const peaks = detector.detect(
        spectrum,
        noiseFloor,
        sampleRate,
        centerFreq,
      );

      expect(peaks.length).toBe(0);
    });

    it("should filter peaks by minimum bandwidth", () => {
      const detector = new PeakDetector(10, 50_000, 1_000_000); // 50 kHz min
      const spectrum = new Float32Array(1000);
      const noiseFloor = -80;
      const sampleRate = 2_000_000;
      const centerFreq = 100_000_000;

      spectrum.fill(noiseFloor);

      // Add a narrow peak (< 50 kHz)
      for (let i = 500; i <= 510; i++) spectrum[i] = -60;

      const peaks = detector.detect(
        spectrum,
        noiseFloor,
        sampleRate,
        centerFreq,
      );

      // Should be filtered out due to bandwidth
      expect(peaks.length).toBe(0);
    });

    it("should filter peaks by maximum bandwidth", () => {
      const detector = new PeakDetector(10, 1000, 50_000); // 50 kHz max
      const spectrum = new Float32Array(1000);
      const noiseFloor = -80;
      const sampleRate = 2_000_000;
      const centerFreq = 100_000_000;

      spectrum.fill(noiseFloor);

      // Add a wide peak (> 50 kHz)
      for (let i = 400; i <= 600; i++) spectrum[i] = -60;

      const peaks = detector.detect(
        spectrum,
        noiseFloor,
        sampleRate,
        centerFreq,
      );

      // Should be filtered out due to bandwidth
      expect(peaks.length).toBe(0);
    });

    it("should calculate peak frequency correctly", () => {
      const spectrum = new Float32Array(1024);
      const noiseFloor = -80;
      const sampleRate = 2_000_000;
      const centerFreq = 100_000_000;

      spectrum.fill(noiseFloor);

      // Add peak at center (bin 512)
      for (let i = 500; i <= 524; i++) spectrum[i] = -60;

      const peaks = detector.detect(
        spectrum,
        noiseFloor,
        sampleRate,
        centerFreq,
      );

      expect(peaks.length).toBe(1);
      // Peak at center should be close to centerFreq (within 100 kHz due to bin resolution)
      expect(peaks[0]!.frequency).toBeCloseTo(centerFreq, -5);
    });

    it("should calculate bandwidth correctly", () => {
      const spectrum = new Float32Array(1000);
      const noiseFloor = -80;
      const sampleRate = 2_000_000;
      const centerFreq = 100_000_000;

      spectrum.fill(noiseFloor);

      // Add peak spanning 50 bins
      // Bandwidth = (50 / 1000) * 2_000_000 = 100 kHz
      for (let i = 475; i <= 525; i++) spectrum[i] = -60;

      const peaks = detector.detect(
        spectrum,
        noiseFloor,
        sampleRate,
        centerFreq,
      );

      expect(peaks.length).toBe(1);
      expect(peaks[0]!.bandwidth).toBeCloseTo(100_000, -2);
    });

    it("should handle peak at end of spectrum", () => {
      const spectrum = new Float32Array(100);
      const noiseFloor = -80;
      const sampleRate = 2_000_000;
      const centerFreq = 100_000_000;

      spectrum.fill(noiseFloor);

      // Add peak at end
      for (let i = 90; i <= 99; i++) spectrum[i] = -60;

      const peaks = detector.detect(
        spectrum,
        noiseFloor,
        sampleRate,
        centerFreq,
      );

      expect(peaks.length).toBe(1);
      expect(peaks[0]!.binIndex).toBeGreaterThanOrEqual(90);
    });
  });
});
