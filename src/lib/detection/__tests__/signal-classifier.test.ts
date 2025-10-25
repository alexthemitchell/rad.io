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
        power: -45,
        bandwidth: 3_000, // 3 kHz - narrow digital
        snr: 35,
      };

      const spectrum = new Float32Array(1024).fill(-80);

      // Create sharp edges (high rolloff)
      for (let i = 500; i <= 524; i++) {
        spectrum[i] = -45;
      }

      const signal = classifier.classify(peak, spectrum);

      expect(signal.type).toBe("digital");
      expect(signal.confidence).toBeGreaterThan(0.5);
    });

    it("should return unknown for unrecognized signals", () => {
      const peak: Peak = {
        binIndex: 512,
        frequency: 100_000_000,
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
        frequency: 100_000_000,
        power: -40,
        bandwidth: 2_000,
        snr: 40,
      };

      const spectrum = new Float32Array(1024).fill(-80);

      // Create very sharp edges
      spectrum[512] = -40;
      spectrum[511] = -41;
      spectrum[510] = -80;
      spectrum[513] = -41;
      spectrum[514] = -80;

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
  });
});
