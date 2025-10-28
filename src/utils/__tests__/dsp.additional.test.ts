/**
 * Additional tests for dsp.ts to improve coverage
 */

import {
  resetSpectrogramWasmDegenerateWarning,
  VALIDATION_RANGE_THRESHOLD_DB,
} from "../dsp";

describe("DSP Additional Tests", () => {
  describe("resetSpectrogramWasmDegenerateWarning", () => {
    it("should not throw when called", () => {
      expect(() => resetSpectrogramWasmDegenerateWarning()).not.toThrow();
    });

    it("should be callable multiple times", () => {
      expect(() => {
        resetSpectrogramWasmDegenerateWarning();
        resetSpectrogramWasmDegenerateWarning();
        resetSpectrogramWasmDegenerateWarning();
      }).not.toThrow();
    });
  });

  describe("VALIDATION_RANGE_THRESHOLD_DB", () => {
    it("should be a number", () => {
      expect(typeof VALIDATION_RANGE_THRESHOLD_DB).toBe("number");
    });

    it("should be a small positive value", () => {
      expect(VALIDATION_RANGE_THRESHOLD_DB).toBeGreaterThan(0);
      expect(VALIDATION_RANGE_THRESHOLD_DB).toBeLessThan(1);
    });

    it("should equal 1e-3", () => {
      expect(VALIDATION_RANGE_THRESHOLD_DB).toBe(1e-3);
    });
  });
});
