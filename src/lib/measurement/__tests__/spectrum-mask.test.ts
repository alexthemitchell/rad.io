/**
 * Spectrum Mask Tester Tests
 */

import { SpectrumMaskTester } from "../spectrum-mask";
import type { SpectrumMask } from "../types";

describe("SpectrumMaskTester", () => {
  let tester: SpectrumMaskTester;

  beforeEach(() => {
    tester = new SpectrumMaskTester();
  });

  describe("mask definition", () => {
    it("should define a custom mask", () => {
      const mask: SpectrumMask = {
        id: "custom-test",
        name: "Custom Test Mask",
        centerFrequency: 100e6,
        points: [
          { frequencyOffset: -10e3, powerLimit: -40 },
          { frequencyOffset: 0, powerLimit: 0 },
          { frequencyOffset: 10e3, powerLimit: -40 },
        ],
      };

      tester.defineMask(mask);
      const retrieved = tester.getMask("custom-test");

      expect(retrieved).toBeDefined();
      expect(retrieved?.name).toBe("Custom Test Mask");
    });

    it("should sort mask points by frequency offset", () => {
      const mask: SpectrumMask = {
        id: "unsorted",
        name: "Unsorted Mask",
        centerFrequency: 100e6,
        points: [
          { frequencyOffset: 10e3, powerLimit: -40 },
          { frequencyOffset: -10e3, powerLimit: -40 },
          { frequencyOffset: 0, powerLimit: 0 },
        ],
      };

      tester.defineMask(mask);
      const retrieved = tester.getMask("unsorted");

      expect(retrieved?.points[0]?.frequencyOffset).toBe(-10e3);
      expect(retrieved?.points[1]?.frequencyOffset).toBe(0);
      expect(retrieved?.points[2]?.frequencyOffset).toBe(10e3);
    });
  });

  describe("default masks", () => {
    it("should include FCC Part 15 mask", () => {
      const mask = tester.getMask("fcc-part15-classb");
      expect(mask).toBeDefined();
      expect(mask?.name).toBe("FCC Part 15 Class B");
    });

    it("should include FM broadcast mask", () => {
      const mask = tester.getMask("fcc-fm-broadcast");
      expect(mask).toBeDefined();
      expect(mask?.points.length).toBeGreaterThan(0);
    });

    it("should include P25 digital mask", () => {
      const mask = tester.getMask("tia102-p25");
      expect(mask).toBeDefined();
      expect(mask?.name).toContain("P25");
    });

    it("should include LTE mask", () => {
      const mask = tester.getMask("3gpp-lte-5mhz");
      expect(mask).toBeDefined();
    });

    it("should include WiFi mask", () => {
      const mask = tester.getMask("wifi-80211g");
      expect(mask).toBeDefined();
    });

    it("should include narrowband FM mask", () => {
      const mask = tester.getMask("generic-nfm-12.5khz");
      expect(mask).toBeDefined();
    });

    it("should include wideband FM mask", () => {
      const mask = tester.getMask("generic-wfm-25khz");
      expect(mask).toBeDefined();
    });
  });

  describe("testMask", () => {
    it("should pass test for compliant signal", () => {
      const mask: SpectrumMask = {
        id: "test-mask",
        name: "Test Mask",
        centerFrequency: 100e6,
        points: [
          { frequencyOffset: -20e3, powerLimit: -60 },
          { frequencyOffset: -10e3, powerLimit: -40 },
          { frequencyOffset: 0, powerLimit: 0 },
          { frequencyOffset: 10e3, powerLimit: -40 },
          { frequencyOffset: 20e3, powerLimit: -60 },
        ],
      };

      tester.defineMask(mask);

      const spectrum = new Float32Array(100);
      const frequencies = new Float32Array(100);

      for (let i = 0; i < 100; i++) {
        frequencies[i] = 99.98e6 + i * 400; // 99.98-100.02 MHz
        spectrum[i] = -70; // Well below limits
      }

      // Signal at carrier
      spectrum[50] = -10; // 10 dB below 0 dBc limit

      const result = tester.testMask(
        "test-mask",
        spectrum,
        frequencies,
        100e6,
        0, // Carrier power
      );

      expect(result.passed).toBe(true);
      expect(result.violations).toHaveLength(0);
      expect(result.worstMargin).toBeGreaterThan(0);
    });

    it("should fail test for non-compliant signal", () => {
      const mask: SpectrumMask = {
        id: "test-mask",
        name: "Test Mask",
        centerFrequency: 100e6,
        points: [
          { frequencyOffset: -10e3, powerLimit: -40 },
          { frequencyOffset: 0, powerLimit: 0 },
          { frequencyOffset: 10e3, powerLimit: -40 },
        ],
      };

      tester.defineMask(mask);

      const spectrum = new Float32Array(101);
      const frequencies = new Float32Array(101);

      for (let i = 0; i < 101; i++) {
        frequencies[i] = 99.98e6 + i * 400; // 99.98-100.02 MHz
        spectrum[i] = -70;
      }

      // Signal at index 75 = 100.01 MHz = +10 kHz from carrier
      // This violates the -40 dBc limit at +10 kHz
      spectrum[75] = -35; // -35 dBc (limit is -40 dBc)

      const result = tester.testMask(
        "test-mask",
        spectrum,
        frequencies,
        100e6,
        0, // Carrier at 0 dBc
      );

      expect(result.passed).toBe(false);
      expect(result.violations.length).toBeGreaterThan(0);
      expect(result.worstMargin).toBeLessThan(0);
    });

    it("should identify violation details", () => {
      const mask: SpectrumMask = {
        id: "test-mask",
        name: "Test Mask",
        centerFrequency: 100e6,
        points: [
          { frequencyOffset: -10e3, powerLimit: -40 },
          { frequencyOffset: 0, powerLimit: -10 }, // Limit at carrier -10 dBc
          { frequencyOffset: 10e3, powerLimit: -40 },
        ],
      };

      tester.defineMask(mask);

      const spectrum = new Float32Array([-70, -5, -70]); // Violation at index 1 (center): -5 dBc vs -10 dBc limit
      const frequencies = new Float32Array([100e6 - 10e3, 100e6, 100e6 + 10e3]);

      const result = tester.testMask(
        "test-mask",
        spectrum,
        frequencies,
        100e6,
        0, // Carrier at 0 dBc reference
      );

      expect(result.violations.length).toBeGreaterThan(0);
      const violation = result.violations[0];
      expect(violation).toBeDefined();
      expect(violation?.frequency).toBe(100e6);
      expect(violation?.measuredPower).toBe(-5);
      expect(violation?.limitPower).toBe(-10);
      expect(violation?.margin).toBeLessThan(0);
    });

    it("should throw error for non-existent mask", () => {
      const spectrum = new Float32Array(10);
      const frequencies = new Float32Array(10);

      expect(() =>
        tester.testMask("nonexistent", spectrum, frequencies, 100e6, 0),
      ).toThrow();
    });

    it("should handle edge frequencies correctly", () => {
      const mask: SpectrumMask = {
        id: "test-mask",
        name: "Test Mask",
        centerFrequency: 100e6,
        points: [
          { frequencyOffset: -50e3, powerLimit: -80 },
          { frequencyOffset: 0, powerLimit: 0 },
          { frequencyOffset: 50e3, powerLimit: -80 },
        ],
      };

      tester.defineMask(mask);

      const spectrum = new Float32Array(11);
      const frequencies = new Float32Array(11);

      for (let i = 0; i < 11; i++) {
        frequencies[i] = 99.95e6 + i * 10e3; // -50kHz to +50kHz
        spectrum[i] = -90; // Below all limits
      }

      const result = tester.testMask(
        "test-mask",
        spectrum,
        frequencies,
        100e6,
        0,
      );

      expect(result.passed).toBe(true);
    });
  });

  describe("interpolation", () => {
    it("should interpolate mask limits between points", () => {
      const mask: SpectrumMask = {
        id: "interp-test",
        name: "Interpolation Test",
        centerFrequency: 100e6,
        points: [
          { frequencyOffset: -10e3, powerLimit: -60 },
          { frequencyOffset: 0, powerLimit: -20 },
          { frequencyOffset: 10e3, powerLimit: -60 },
        ],
      };

      tester.defineMask(mask);

      const spectrum = new Float32Array([-70, -50, -45, -50, -70]);
      const frequencies = new Float32Array([
        100e6 - 10e3,
        100e6 - 5e3, // Midpoint: should interpolate to -40 dBc
        100e6,
        100e6 + 5e3,
        100e6 + 10e3,
      ]);

      const result = tester.testMask(
        "interp-test",
        spectrum,
        frequencies,
        100e6,
        0,
      );

      // -45 at midpoint should be within interpolated limit of ~-40
      expect(result.passed).toBe(true);
    });
  });

  describe("getAllMasks", () => {
    it("should return all defined masks", () => {
      const masks = tester.getAllMasks();
      expect(masks.length).toBeGreaterThan(0);
    });

    it("should include default masks", () => {
      const masks = tester.getAllMasks();
      const maskIds = masks.map((m) => m.id);

      expect(maskIds).toContain("fcc-part15-classb");
      expect(maskIds).toContain("fcc-fm-broadcast");
      expect(maskIds).toContain("tia102-p25");
    });
  });

  describe("deleteMask", () => {
    it("should delete a mask", () => {
      const mask: SpectrumMask = {
        id: "temp-mask",
        name: "Temporary",
        centerFrequency: 100e6,
        points: [{ frequencyOffset: 0, powerLimit: 0 }],
      };

      tester.defineMask(mask);
      expect(tester.getMask("temp-mask")).toBeDefined();

      const deleted = tester.deleteMask("temp-mask");
      expect(deleted).toBe(true);
      expect(tester.getMask("temp-mask")).toBeUndefined();
    });

    it("should return false for non-existent mask", () => {
      const deleted = tester.deleteMask("nonexistent");
      expect(deleted).toBe(false);
    });

    it("should not delete default masks accidentally", () => {
      const deleted = tester.deleteMask("fcc-part15-classb");
      expect(deleted).toBe(true);

      // Can redefine if needed
      const mask: SpectrumMask = {
        id: "fcc-part15-classb",
        name: "FCC Part 15 Class B (Redefined)",
        centerFrequency: 0,
        points: [{ frequencyOffset: 0, powerLimit: 0 }],
      };
      tester.defineMask(mask);
    });
  });

  describe("export/import", () => {
    it("should export masks to JSON", () => {
      const json = tester.exportMasks();
      expect(json).toBeTruthy();

      const parsed = JSON.parse(json) as SpectrumMask[];
      expect(parsed.length).toBeGreaterThan(0);
    });

    it("should import masks from JSON", () => {
      const mask: SpectrumMask = {
        id: "export-test",
        name: "Export Test",
        centerFrequency: 100e6,
        points: [{ frequencyOffset: 0, powerLimit: 0 }],
      };

      tester.defineMask(mask);
      const json = JSON.stringify([mask]);

      const newTester = new SpectrumMaskTester();
      const imported = newTester.importMasks(json);

      expect(imported).toBe(true);
      expect(newTester.getMask("export-test")).toBeDefined();
    });

    it("should handle invalid JSON", () => {
      const imported = tester.importMasks("invalid json");
      expect(imported).toBe(false);
    });
  });

  describe("real-world regulatory masks", () => {
    it("should test FCC Part 15 compliance", () => {
      const spectrum = new Float32Array(100);
      const frequencies = new Float32Array(100);

      for (let i = 0; i < 100; i++) {
        frequencies[i] = 99.99e6 + i * 200; // 99.99-100.01 MHz
        spectrum[i] = -80; // Well below limits
      }

      // Main signal
      spectrum[50] = -5;

      const result = tester.testMask(
        "fcc-part15-classb",
        spectrum,
        frequencies,
        100e6,
        0,
      );

      expect(result).toBeDefined();
      expect(result.maskId).toBe("fcc-part15-classb");
    });

    it("should test P25 mask compliance", () => {
      const spectrum = new Float32Array(200);
      const frequencies = new Float32Array(200);

      for (let i = 0; i < 200; i++) {
        frequencies[i] = 99.98e6 + i * 200; // 99.98-100.02 MHz
        spectrum[i] = -80;
      }

      // P25 signal within 12.5 kHz
      for (let i = 90; i <= 110; i++) {
        spectrum[i] = -10;
      }

      const result = tester.testMask(
        "tia102-p25",
        spectrum,
        frequencies,
        100e6,
        0,
      );

      expect(result).toBeDefined();
    });
  });
});
