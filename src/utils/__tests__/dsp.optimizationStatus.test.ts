/**
 * Tests for optimization status API
 */

import {
  getOptimizationStatus,
  logOptimizationStatus,
  type OptimizationStatus,
} from "../dsp";

describe("Optimization Status API", () => {
  describe("getOptimizationStatus", () => {
    it("should return optimization status object", () => {
      const status = getOptimizationStatus();

      expect(status).toBeDefined();
      expect(typeof status).toBe("object");
    });

    it("should have all required fields", () => {
      const status = getOptimizationStatus();

      expect(status).toHaveProperty("wasmAvailable");
      expect(status).toHaveProperty("wasmVariant");
      expect(status).toHaveProperty("sharedArrayBuffer");
      expect(status).toHaveProperty("webGPU");
      expect(status).toHaveProperty("crossOriginIsolated");
    });

    it("should return boolean values", () => {
      const status = getOptimizationStatus();

      expect(typeof status.wasmAvailable).toBe("boolean");
      expect(typeof status.sharedArrayBuffer).toBe("boolean");
      expect(typeof status.webGPU).toBe("boolean");
      expect(typeof status.crossOriginIsolated).toBe("boolean");
    });

    it("should return valid wasmVariant", () => {
      const status = getOptimizationStatus();

      expect(["simd", "standard", "none"]).toContain(status.wasmVariant);
    });

    it("wasmVariant should match wasmAvailable", () => {
      const status = getOptimizationStatus();

      if (status.wasmAvailable) {
        expect(["simd", "standard"]).toContain(status.wasmVariant);
      } else {
        expect(status.wasmVariant).toBe("none");
      }
    });

    it("should be stable across multiple calls", () => {
      const status1 = getOptimizationStatus();
      const status2 = getOptimizationStatus();

      expect(status1.wasmAvailable).toBe(status2.wasmAvailable);
      expect(status1.wasmVariant).toBe(status2.wasmVariant);
      expect(status1.sharedArrayBuffer).toBe(status2.sharedArrayBuffer);
      expect(status1.webGPU).toBe(status2.webGPU);
      expect(status1.crossOriginIsolated).toBe(status2.crossOriginIsolated);
    });

    it("should correctly detect feature relationships", () => {
      const status = getOptimizationStatus();

      // If SharedArrayBuffer is available, crossOriginIsolated should be true
      if (status.sharedArrayBuffer) {
        expect(status.crossOriginIsolated).toBe(true);
      }

      // If WASM SIMD is available, WASM must be available
      if (status.wasmVariant === "simd") {
        expect(status.wasmAvailable).toBe(true);
      }
    });
  });

  describe("logOptimizationStatus", () => {
    it("should not throw when called", () => {
      expect(() => logOptimizationStatus()).not.toThrow();
    });

    it("should be callable multiple times", () => {
      expect(() => {
        logOptimizationStatus();
        logOptimizationStatus();
        logOptimizationStatus();
      }).not.toThrow();
    });
  });

  describe("OptimizationStatus type", () => {
    it("should match expected structure", () => {
      const status: OptimizationStatus = {
        wasmAvailable: true,
        wasmVariant: "simd",
        sharedArrayBuffer: false,
        webGPU: false,
        crossOriginIsolated: false,
      };

      expect(status).toBeDefined();
      expect(status.wasmVariant).toBe("simd");
    });
  });
});
