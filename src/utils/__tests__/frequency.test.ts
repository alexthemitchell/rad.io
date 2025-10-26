/**
 * Tests for frequency utility functions
 */

import { formatFrequency, formatSampleRate } from "../frequency";
import { generateBookmarkId } from "../id";

describe("frequency utilities", () => {
  describe("formatFrequency", () => {
    it("should format GHz frequencies", () => {
      expect(formatFrequency(1e9)).toBe("1.000000 GHz");
      expect(formatFrequency(2.4e9)).toBe("2.400000 GHz");
      expect(formatFrequency(5.8e9)).toBe("5.800000 GHz");
    });

    it("should format MHz frequencies", () => {
      expect(formatFrequency(1e6)).toBe("1.000 MHz");
      expect(formatFrequency(100e6)).toBe("100.000 MHz");
      expect(formatFrequency(433.92e6)).toBe("433.920 MHz");
      expect(formatFrequency(915e6)).toBe("915.000 MHz");
    });

    it("should format kHz frequencies", () => {
      expect(formatFrequency(1e3)).toBe("1.0 kHz");
      expect(formatFrequency(10e3)).toBe("10.0 kHz");
      expect(formatFrequency(162.55e3)).toBe("162.6 kHz");
    });

    it("should format Hz frequencies", () => {
      expect(formatFrequency(100)).toBe("100 Hz");
      expect(formatFrequency(500)).toBe("500 Hz");
      expect(formatFrequency(999)).toBe("999 Hz");
    });

    it("should handle zero frequency", () => {
      expect(formatFrequency(0)).toBe("0 Hz");
    });

    it("should handle very large frequencies", () => {
      expect(formatFrequency(10e9)).toBe("10.000000 GHz");
    });

    it("should handle very small frequencies", () => {
      expect(formatFrequency(1)).toBe("1 Hz");
    });
  });

  describe("formatSampleRate", () => {
    it("should format MSPS sample rates", () => {
      expect(formatSampleRate(1e6)).toBe("1.00 MSPS");
      expect(formatSampleRate(2.048e6)).toBe("2.05 MSPS");
      expect(formatSampleRate(20e6)).toBe("20.00 MSPS");
    });

    it("should format kSPS sample rates", () => {
      expect(formatSampleRate(1e3)).toBe("1.00 kSPS");
      expect(formatSampleRate(48e3)).toBe("48.00 kSPS");
      expect(formatSampleRate(250e3)).toBe("250.00 kSPS");
    });

    it("should format SPS sample rates", () => {
      expect(formatSampleRate(100)).toBe("100 SPS");
      expect(formatSampleRate(500)).toBe("500 SPS");
      expect(formatSampleRate(999)).toBe("999 SPS");
    });

    it("should handle zero sample rate", () => {
      expect(formatSampleRate(0)).toBe("0 SPS");
    });

    it("should handle common SDR sample rates", () => {
      expect(formatSampleRate(2.048e6)).toBe("2.05 MSPS"); // HackRF One
      expect(formatSampleRate(2.4e6)).toBe("2.40 MSPS"); // RTL-SDR
      expect(formatSampleRate(20e6)).toBe("20.00 MSPS"); // HackRF One max
    });
  });

  describe("generateBookmarkId", () => {
    it("should generate ID with bm- prefix", () => {
      const id = generateBookmarkId();
      expect(id).toMatch(/^bm-/);
    });

    it("should generate unique IDs", () => {
      const id1 = generateBookmarkId();
      const id2 = generateBookmarkId();
      expect(id1).not.toBe(id2);
    });

    it("should generate valid UUID format", () => {
      const id = generateBookmarkId();
      // Remove bm- prefix and check UUID format
      const uuid = id.substring(3);
      expect(uuid).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
      );
    });

    it("should generate multiple unique IDs", () => {
      const ids = Array.from({ length: 100 }, () => generateBookmarkId());
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(100);
    });
  });
});
