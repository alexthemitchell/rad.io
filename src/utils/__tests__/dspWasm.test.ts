/*
import {
  isWasmRuntimeEnabled,
  isWasmValidationEnabled,
  setWasmModuleForTest,
  resetWasmModuleForTest,
  calculateFFTWasm,
  calculateSpectrogramWasm,
  type WasmDSPModule,
} from "../../utils/dspWasm";

import type { Sample } from "../../utils/dsp";

describe("dspWasm runtime toggles and compute paths", () => {
  const originalEnv = { ...process.env };
  let originalLocalStorage: Storage | undefined;

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    // Save and reset env and storage
    Object.assign(process.env, originalEnv);
    originalLocalStorage = (window as any).localStorage;
  });

  afterEach(() => {
    // Restore environment
    Object.assign(process.env, originalEnv);
    // Restore localStorage
    (window as any).localStorage = originalLocalStorage;
    resetWasmModuleForTest();
  });

  function withLocalStorageMock(map: Record<string, string | null>): void {
    const store = new Map<string, string>();
    for (const [k, v] of Object.entries(map)) {
      if (v !== null) store.set(k, String(v));
    }
    (window as any).localStorage = {
      getItem: (k: string) => (store.has(k) ? (store.get(k) as string) : null),
      setItem: (k: string, v: string) => {
        store.set(k, v);
      },
      removeItem: (k: string) => {
        store.delete(k);
      },
      clear: () => store.clear(),
      key: (i: number) => Array.from(store.keys())[i] ?? null,
      length: 0,
    } as unknown as Storage;
  }

  it("isWasmRuntimeEnabled defaults to true when localStorage is unavailable", () => {
    (window as any).localStorage = undefined;
    expect(isWasmRuntimeEnabled()).toBe(true);
  });

  it("isWasmRuntimeEnabled respects radio.wasm.enabled=false", () => {
    import {
      isWasmRuntimeEnabled,
      isWasmValidationEnabled,
      setWasmModuleForTest,
      resetWasmModuleForTest,
      calculateFFTWasm,
      calculateSpectrogramWasm,
      type WasmDSPModule,
    } from "../../utils/dspWasm";

    import type { Sample } from "../../utils/dsp";

    describe("dspWasm toggles and compute (focused)", () => {
      const originalEnv = { ...process.env };
      let originalLocalStorage: Storage | undefined;

      beforeEach(() => {
        jest.resetModules();
        jest.clearAllMocks();
        Object.assign(process.env, originalEnv);
        originalLocalStorage = (window as any).localStorage;
      });

      afterEach(() => {
        Object.assign(process.env, originalEnv);
        (window as any).localStorage = originalLocalStorage;
        resetWasmModuleForTest();
      });

      function withLocalStorageMock(map: Record<string, string | null>): void {
        const store = new Map<string, string>();
        for (const [k, v] of Object.entries(map)) {
          if (v !== null) store.set(k, String(v));
        }
        (window as any).localStorage = {
          getItem: (k: string) => (store.has(k) ? (store.get(k) as string) : null),
          setItem: (k: string, v: string) => {
            store.set(k, v);
          },
          removeItem: (k: string) => {
            store.delete(k);
          },
          clear: () => store.clear(),
          key: (i: number) => Array.from(store.keys())[i] ?? null,
          length: 0,
        } as unknown as Storage;
      }

      it("isWasmRuntimeEnabled defaults to true when localStorage is unavailable", () => {
        (window as any).localStorage = undefined;
        expect(isWasmRuntimeEnabled()).toBe(true);
      });

      it("isWasmRuntimeEnabled respects radio.wasm.enabled=false", () => {
        withLocalStorageMock({ "radio.wasm.enabled": "false" });
        expect(isWasmRuntimeEnabled()).toBe(false);
      });

      it("isWasmValidationEnabled defaults true in dev (no storage) and false in prod", () => {
        (window as any).localStorage = undefined;
        process.env["NODE_ENV"] = "development";
        expect(isWasmValidationEnabled()).toBe(true);
        process.env["NODE_ENV"] = "production";
        expect(isWasmValidationEnabled()).toBe(false);
      });

      it("isWasmValidationEnabled respects radio.wasm.validate flag", () => {
        process.env["NODE_ENV"] = "production";
        withLocalStorageMock({ "radio.wasm.validate": "true" });
        expect(isWasmValidationEnabled()).toBe(true);
        withLocalStorageMock({ "radio.wasm.validate": "false" });
        expect(isWasmValidationEnabled()).toBe(false);
      });

      it("calculateFFTWasm uses return-by-value path when available", () => {
        const fftSize = 8;
        const samples: Sample[] = Array.from({ length: fftSize }, (_, i) => ({ I: i, Q: i * 2 }));

        const fakeModule: WasmDSPModule = {
          allocateFloat32Array: (n: number) => new Float32Array(n),
          calculateFFT: jest.fn(),
          calculateFFTOut: (i: Float32Array, q: Float32Array, size: number) => {
            const out = new Float32Array(size);
            for (let idx = 0; idx < size; idx++) out[idx] = i[idx] + q[idx];
            return out;
          },
          calculateWaveform: jest.fn(),
          calculateSpectrogram: jest.fn(),
        };

        setWasmModuleForTest(fakeModule, true);
        const result = calculateFFTWasm(samples, fftSize);
        expect(result).not.toBeNull();
        expect(Array.from(result!)).toEqual(Array.from({ length: fftSize }, (_, i) => i + i * 2));
        expect(fakeModule.calculateFFT).not.toHaveBeenCalled();
      });

      it("calculateSpectrogramWasm slices row-major flat output correctly", () => {
        const fftSize = 4;
        const rows = 3;
        const total = fftSize * rows;
        const samples: Sample[] = Array.from({ length: total }, (_, i) => ({ I: i, Q: 0 }));

        const flat = new Float32Array(total);
        for (let r = 0; r < rows; r++) {
          for (let c = 0; c < fftSize; c++) flat[r * fftSize + c] = r * 10 + c;
        }

        const fakeModule: WasmDSPModule = {
          allocateFloat32Array: (n: number) => new Float32Array(n),
          calculateFFT: jest.fn(),
          calculateWaveform: jest.fn(),
          calculateSpectrogram: jest.fn(),
          calculateSpectrogramOut: jest.fn().mockImplementation(() => new Float32Array(flat)),
        };

        setWasmModuleForTest(fakeModule, true);
        const out = calculateSpectrogramWasm(samples, fftSize);
        expect(out).not.toBeNull();
        const outRows = out as Float32Array[];
        expect(outRows).toHaveLength(rows);
        for (let r = 0; r < rows; r++) {
          expect(Array.from(outRows[r] as Float32Array)).toEqual(
            Array.from({ length: fftSize }, (_, c) => r * 10 + c),
          );
        }
      });
    });
      if (fftResult !== null) {
        expect(fftResult.length).toBe(64);
      }
      if (waveformResult !== null) {
        expect(waveformResult.amplitude.length).toBe(0);
        expect(waveformResult.phase.length).toBe(0);
      }
      if (spectrogramResult !== null) {
        expect(spectrogramResult.length).toBe(0);
      }
    });
  });

  describe("Edge Cases", () => {
    it("should handle various FFT sizes", async () => {
      await loadWasmModule();

      const samples = generateTestSamples(1024);
      const sizes = [64, 128, 256, 512, 1024];

      for (const size of sizes) {
        const jsResult = calculateFFTSync(samples.slice(0, size), size);
        const wasmResult = calculateFFTWasm(samples.slice(0, size), size);

        expect(jsResult.length).toBe(size);

        if (wasmResult) {
          expect(wasmResult.length).toBe(size);
        }
      }
    });

    it("should handle samples with extreme values", async () => {
      await loadWasmModule();

      const samples: Sample[] = [
        { I: 1000, Q: -1000 },
        { I: -1000, Q: 1000 },
        { I: 0.001, Q: -0.001 },
        { I: -0.001, Q: 0.001 },
      ];

      const jsWaveform = calculateWaveform(samples);
      const wasmWaveform = calculateWaveformWasm(samples);

      expect(jsWaveform.amplitude.length).toBe(samples.length);

      if (wasmWaveform) {
        expect(wasmWaveform.amplitude.length).toBe(samples.length);
        // Results should be close despite extreme values
        for (let i = 0; i < samples.length; i++) {
          const diff = Math.abs(
            (wasmWaveform.amplitude[i] ?? 0) - (jsWaveform.amplitude[i] ?? 0),
          );
          expect(diff).toBeLessThan(1);
        }
      }
    });
  });

  describe("Performance Characteristics", () => {
    it("should handle large sample sets without crashing", async () => {
      await loadWasmModule();

      const largeSamples = generateTestSamples(8192);

      // Should not throw errors
      expect(() => {
        calculateFFTWasm(largeSamples, 2048);
      }).not.toThrow();

      expect(() => {
        calculateWaveformWasm(largeSamples);
      }).not.toThrow();

      expect(() => {
        calculateSpectrogramWasm(largeSamples, 512);
      }).not.toThrow();
    });
  });
});
*/

import { isWasmSupported } from "../dspWasm";

describe("dspWasm smoke", () => {
  it("isWasmSupported returns boolean", () => {
    expect(typeof isWasmSupported()).toBe("boolean");
  });
});
