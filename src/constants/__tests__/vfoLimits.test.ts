/**
 * Tests for VFO Limits and Configuration
 */

import {
  DEFAULT_MAX_VFOS,
  ABSOLUTE_MAX_VFOS,
  MIN_VFOS,
  DSP_TIME_WARNING_THRESHOLD_MS,
  DSP_TIME_CRITICAL_THRESHOLD_MS,
  MAX_CONCURRENT_AUDIO_VFOS,
  VFO_COMPLEXITY_FACTORS,
  PLATFORM_MAX_VFOS,
  calculateDynamicVfoLimit,
  getPlatformVfoLimit,
  validateMaxVfos,
} from "../vfoLimits";

describe("vfoLimits constants", () => {
  describe("constant values", () => {
    it("should have DEFAULT_MAX_VFOS of 4", () => {
      expect(DEFAULT_MAX_VFOS).toBe(4);
    });

    it("should have ABSOLUTE_MAX_VFOS of 16", () => {
      expect(ABSOLUTE_MAX_VFOS).toBe(16);
    });

    it("should have MIN_VFOS of 1", () => {
      expect(MIN_VFOS).toBe(1);
    });

    it("should have sensible DSP time thresholds", () => {
      expect(DSP_TIME_WARNING_THRESHOLD_MS).toBe(8.0);
      expect(DSP_TIME_CRITICAL_THRESHOLD_MS).toBe(12.0);
      expect(DSP_TIME_CRITICAL_THRESHOLD_MS).toBeGreaterThan(
        DSP_TIME_WARNING_THRESHOLD_MS,
      );
    });

    it("should have MAX_CONCURRENT_AUDIO_VFOS of 8", () => {
      expect(MAX_CONCURRENT_AUDIO_VFOS).toBe(8);
    });
  });

  describe("VFO_COMPLEXITY_FACTORS", () => {
    it("should have complexity factors for all modes", () => {
      expect(VFO_COMPLEXITY_FACTORS.am).toBe(1.0);
      expect(VFO_COMPLEXITY_FACTORS.nbfm).toBe(1.5);
      expect(VFO_COMPLEXITY_FACTORS.wbfm).toBe(2.0);
      expect(VFO_COMPLEXITY_FACTORS.usb).toBe(1.2);
      expect(VFO_COMPLEXITY_FACTORS.lsb).toBe(1.2);
      expect(VFO_COMPLEXITY_FACTORS.cw).toBe(0.8);
      expect(VFO_COMPLEXITY_FACTORS["atsc-8vsb"]).toBe(5.0);
    });

    it("should have AM as baseline (1.0)", () => {
      expect(VFO_COMPLEXITY_FACTORS.am).toBe(1.0);
    });

    it("should have ATSC as most complex", () => {
      const maxComplexity = Math.max(...Object.values(VFO_COMPLEXITY_FACTORS));
      expect(VFO_COMPLEXITY_FACTORS["atsc-8vsb"]).toBe(maxComplexity);
    });
  });

  describe("PLATFORM_MAX_VFOS", () => {
    it("should have limits for all platforms", () => {
      expect(PLATFORM_MAX_VFOS.desktop_high).toBe(12);
      expect(PLATFORM_MAX_VFOS.desktop_mid).toBe(8);
      expect(PLATFORM_MAX_VFOS.laptop).toBe(6);
      expect(PLATFORM_MAX_VFOS.mobile).toBe(3);
      expect(PLATFORM_MAX_VFOS.default).toBe(DEFAULT_MAX_VFOS);
    });

    it("should have desktop_high as maximum", () => {
      const maxPlatform = Math.max(...Object.values(PLATFORM_MAX_VFOS));
      expect(PLATFORM_MAX_VFOS.desktop_high).toBe(maxPlatform);
    });

    it("should have mobile as minimum", () => {
      // Filter out 'default' which might be 4
      const platformLimits = Object.entries(PLATFORM_MAX_VFOS)
        .filter(([key]) => key !== "default")
        .map(([, value]) => value);
      const minPlatform = Math.min(...platformLimits);
      expect(PLATFORM_MAX_VFOS.mobile).toBe(minPlatform);
    });
  });

  describe("calculateDynamicVfoLimit", () => {
    it("should return base limit when no VFOs active", () => {
      const result = calculateDynamicVfoLimit(4, []);
      expect(result).toBe(4);
    });

    it("should reduce limit based on complexity", () => {
      const result = calculateDynamicVfoLimit(4, [
        { modeId: "am" }, // 1.0
        { modeId: "wbfm" }, // 2.0
      ]);
      expect(result).toBe(1); // 4 - 1.0 - 2.0 = 1.0 -> floor = 1
    });

    it("should return 0 when complexity exceeds limit", () => {
      const result = calculateDynamicVfoLimit(4, [
        { modeId: "atsc-8vsb" }, // 5.0
      ]);
      expect(result).toBe(0); // 4 - 5.0 = -1.0 -> max(0, -1.0) = 0
    });

    it("should use 1.0 as default complexity for unknown modes", () => {
      const result = calculateDynamicVfoLimit(4, [
        { modeId: "unknown-mode" },
      ]);
      expect(result).toBe(3); // 4 - 1.0 = 3.0
    });

    it("should handle multiple VFOs of same mode", () => {
      const result = calculateDynamicVfoLimit(4, [
        { modeId: "am" }, // 1.0
        { modeId: "am" }, // 1.0
        { modeId: "am" }, // 1.0
      ]);
      expect(result).toBe(1); // 4 - 3.0 = 1.0
    });
  });

  describe("getPlatformVfoLimit", () => {
    it("should return platform-specific limit", () => {
      expect(getPlatformVfoLimit("desktop_high")).toBe(12);
      expect(getPlatformVfoLimit("laptop")).toBe(6);
      expect(getPlatformVfoLimit("mobile")).toBe(3);
    });

    it("should return default for unknown platform", () => {
      expect(getPlatformVfoLimit("unknown")).toBe(DEFAULT_MAX_VFOS);
    });

    it("should return default when platform is undefined", () => {
      expect(getPlatformVfoLimit()).toBe(DEFAULT_MAX_VFOS);
    });
  });

  describe("validateMaxVfos", () => {
    it("should accept valid values", () => {
      expect(validateMaxVfos(4)).toBe(4);
      expect(validateMaxVfos(8)).toBe(8);
      expect(validateMaxVfos(12)).toBe(12);
    });

    it("should clamp to MIN_VFOS when below minimum", () => {
      expect(validateMaxVfos(0)).toBe(MIN_VFOS);
      expect(validateMaxVfos(-5)).toBe(MIN_VFOS);
    });

    it("should clamp to ABSOLUTE_MAX_VFOS when above maximum", () => {
      expect(validateMaxVfos(20)).toBe(ABSOLUTE_MAX_VFOS);
      expect(validateMaxVfos(100)).toBe(ABSOLUTE_MAX_VFOS);
    });

    it("should floor decimal values", () => {
      expect(validateMaxVfos(4.7)).toBe(4);
      expect(validateMaxVfos(8.2)).toBe(8);
    });

    it("should handle edge cases", () => {
      expect(validateMaxVfos(MIN_VFOS)).toBe(MIN_VFOS);
      expect(validateMaxVfos(ABSOLUTE_MAX_VFOS)).toBe(ABSOLUTE_MAX_VFOS);
    });
  });
});
