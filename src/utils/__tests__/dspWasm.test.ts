import {
  isWasmSupported,
  isWasmSIMDSupported,
  getWasmVariant,
} from "../dspWasm";

describe("dspWasm", () => {
  describe("Basic WASM support", () => {
    it("isWasmSupported returns boolean", () => {
      expect(typeof isWasmSupported()).toBe("boolean");
    });
  });

  describe("SIMD support detection", () => {
    it("isWasmSIMDSupported returns boolean", () => {
      const supported = isWasmSIMDSupported();
      expect(typeof supported).toBe("boolean");
    });

    it("getWasmVariant returns correct variant", () => {
      const variant = getWasmVariant();
      expect(["simd", "standard"]).toContain(variant);
    });

    it("getWasmVariant should match SIMD detection", () => {
      const simdSupported = isWasmSIMDSupported();
      const variant = getWasmVariant();

      if (simdSupported) {
        expect(variant).toBe("simd");
      } else {
        expect(variant).toBe("standard");
      }
    });

    it("SIMD detection should be stable", () => {
      // Call multiple times, should return same result
      const result1 = isWasmSIMDSupported();
      const result2 = isWasmSIMDSupported();
      const result3 = isWasmSIMDSupported();

      expect(result1).toBe(result2);
      expect(result2).toBe(result3);
    });
  });
});
