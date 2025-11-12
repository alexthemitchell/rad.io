/**
 * Signal Classifier Tests
 */

import { SignalClassifier } from "../signal-classifier";
import type { Peak } from "../peak-detector";

describe("SignalClassifier", () => {
  let classifier: SignalClassifier;

  beforeEach(() => {
    classifier = new SignalClassifier();
  });

  describe("classify", () => {
    it("should classify narrowband FM signal", () => {
      const peak: Peak = {
        binIndex: 512,
        frequency: 146_000_000,
        power: -50,
        bandwidth: 15_000, // 15 kHz - typical NFM
        snr: 30,
      };

      const spectrum = new Float32Array(1024).fill(-80);
      const signal = classifier.classify(peak, spectrum);

      expect(signal.type).toBe("narrowband-fm");
      expect(signal.confidence).toBeGreaterThan(0.7);
    });

    it("should classify wideband FM signal", () => {
      const peak: Peak = {
        binIndex: 512,
        frequency: 98_100_000,
        power: -40,
        bandwidth: 200_000, // 200 kHz - typical WFM broadcast
        snr: 40,
      };

      const spectrum = new Float32Array(1024).fill(-80);
      const signal = classifier.classify(peak, spectrum);

      expect(signal.type).toBe("wideband-fm");
      expect(signal.confidence).toBeGreaterThan(0.8);
    });

    it("should classify AM signal", () => {
      const peak: Peak = {
        binIndex: 512,
        frequency: 1_000_000,
        power: -55,
        bandwidth: 10_000, // 10 kHz - typical AM
        snr: 25,
      };

      const spectrum = new Float32Array(1024).fill(-80);
      const signal = classifier.classify(peak, spectrum);

      expect(signal.type).toBe("am");
      expect(signal.confidence).toBeGreaterThan(0.6);
    });

    it("should classify digital signal with sharp edges", () => {
      const peak: Peak = {
        binIndex: 512,
        frequency: 446_000_000,
        power: 10, // Positive power value
        bandwidth: 3_000, // 3 kHz - narrow digital
        snr: 35,
      };

      const spectrum = new Float32Array(1024).fill(-80);

      // Create sharp edges (narrow peak with steep rolloff)
      // Peak at 10, halfPower = 5
      spectrum[512] = 10; // Peak
      spectrum[511] = 6; // Above halfPower (5)
      spectrum[513] = 6; // Above halfPower (5)
      // leftEdge will be 510 (spectrum[510] = -80 < 5)
      // rightEdge will be 514 (spectrum[514] = -80 < 5)
      // edgeWidth = 514 - 510 = 4
      // rolloff = abs(10) / 4 = 2.5
      // sharpness = min(2.5 / 5, 1) = 0.5 (NOT > 0.5)
      // Need sharper! Use only 3 bins:
      spectrum[510] = -80;
      spectrum[511] = 6;
      spectrum[512] = 10;
      spectrum[513] = 6;
      spectrum[514] = -80;
      // Still edgeWidth = 4. Need only 2 bins total for edgeWidth = 2:
      spectrum[511] = -80; // Below halfPower
      spectrum[513] = -80; // Below halfPower
      // Now: leftEdge = 511, rightEdge = 513, edgeWidth = 2
      // rolloff = 10 / 2 = 5, sharpness = 5/5 = 1.0 > 0.5 ✓

      const signal = classifier.classify(peak, spectrum);

      expect(signal.type).toBe("digital");
      expect(signal.confidence).toBeGreaterThan(0.5);
    });

    it("should return unknown for unrecognized signals", () => {
      const peak: Peak = {
        binIndex: 512,
        frequency: 50_000_000, // 50 MHz (outside FM broadcast band)
        bandwidth: 500_000, // Very wide, doesn't match any pattern
        power: -50,
        snr: 30,
      };

      const spectrum = new Float32Array(1024).fill(-80);
      const signal = classifier.classify(peak, spectrum);

      expect(signal.type).toBe("unknown");
      expect(signal.confidence).toBe(0);
    });

    it("should preserve peak properties", () => {
      const peak: Peak = {
        binIndex: 512,
        frequency: 146_000_000,
        power: -50,
        bandwidth: 15_000,
        snr: 30,
      };

      const spectrum = new Float32Array(1024).fill(-80);
      const signal = classifier.classify(peak, spectrum);

      expect(signal.binIndex).toBe(peak.binIndex);
      expect(signal.frequency).toBe(peak.frequency);
      expect(signal.power).toBe(peak.power);
      expect(signal.bandwidth).toBe(peak.bandwidth);
      expect(signal.snr).toBe(peak.snr);
    });

    it("should handle edge sharpness measurement", () => {
      const peak: Peak = {
        binIndex: 512,
        frequency: 150_000_000, // Changed from 100 MHz (FM broadcast) to 150 MHz to test digital classification
        power: 10, // Positive power value
        bandwidth: 2_000,
        snr: 40,
      };

      const spectrum = new Float32Array(1024).fill(-80);

      // Create sharp edges - single bin peak
      // Peak at 10, halfPower = 5
      spectrum[512] = 10; // Only the peak bin > halfPower
      // leftEdge = 511, rightEdge = 513, edgeWidth = 2
      // rolloff = 10 / 2 = 5, sharpness = 1.0 > 0.5

      const signal = classifier.classify(peak, spectrum);

      // With sharp edges and narrow bandwidth, should classify as digital
      expect(signal.type).toBe("digital");
    });
  });

  describe("boundary cases", () => {
    it("should handle bandwidth at classification boundaries", () => {
      // Test bandwidth exactly at 12 kHz (NFM lower bound)
      const peakNFMLower: Peak = {
        binIndex: 512,
        frequency: 146_000_000,
        power: -50,
        bandwidth: 12_000,
        snr: 30,
      };

      const spectrum = new Float32Array(1024).fill(-80);
      const signalNFMLower = classifier.classify(peakNFMLower, spectrum);

      expect(signalNFMLower.type).toBe("narrowband-fm");

      // Test bandwidth exactly at 30 kHz (NFM upper bound)
      const peakNFMUpper: Peak = {
        binIndex: 512,
        frequency: 146_000_000,
        power: -50,
        bandwidth: 30_000,
        snr: 30,
      };

      const signalNFMUpper = classifier.classify(peakNFMUpper, spectrum);

      expect(signalNFMUpper.type).toBe("narrowband-fm");
    });

    it("should always classify FM broadcast band (88-108 MHz) as wideband-fm", () => {
      const spectrum = new Float32Array(1024).fill(-80);

      // Test low end of FM band - even with narrow measured bandwidth
      const peak88MHz: Peak = {
        binIndex: 512,
        frequency: 88_100_000,
        power: -50,
        bandwidth: 5_000, // Very narrow measurement due to fading
        snr: 15,
      };
      const signal88 = classifier.classify(peak88MHz, spectrum);
      expect(signal88.type).toBe("wideband-fm");
      expect(signal88.confidence).toBeGreaterThan(0.7);

      // Test middle of FM band - with moderate bandwidth
      const peak100MHz: Peak = {
        binIndex: 512,
        frequency: 100_300_000,
        power: -40,
        bandwidth: 40_000,
        snr: 25,
      };
      const signal100 = classifier.classify(peak100MHz, spectrum);
      expect(signal100.type).toBe("wideband-fm");
      expect(signal100.confidence).toBeGreaterThan(0.8);

      // Test high end of FM band - with full bandwidth
      const peak108MHz: Peak = {
        binIndex: 512,
        frequency: 107_900_000,
        power: -30,
        bandwidth: 200_000,
        snr: 35,
      };
      const signal108 = classifier.classify(peak108MHz, spectrum);
      expect(signal108.type).toBe("wideband-fm");
      expect(signal108.confidence).toBeGreaterThan(0.9);
    });
  });
});
