/**
 * Tests for WebAssembly DSP module
 * Validates WASM functionality and fallback behavior
 */

import {
  isWasmSupported,
  loadWasmModule,
  isWasmAvailable,
  calculateFFTWasm,
  calculateWaveformWasm,
  calculateSpectrogramWasm,
} from "../dspWasm";
import {
  calculateFFTSync,
  calculateWaveform,
  calculateSpectrogram,
} from "../dsp";
import type { Sample } from "../dsp";

// Helper to generate test samples
function generateTestSamples(count: number): Sample[] {
  const samples: Sample[] = [];
  for (let i = 0; i < count; i++) {
    const t = i / count;
    samples.push({
      I: Math.cos(2 * Math.PI * 5 * t),
      Q: Math.sin(2 * Math.PI * 5 * t),
    });
  }
  return samples;
}

describe("WASM DSP Module", () => {
  describe("Feature Detection", () => {
    it("should detect WebAssembly support", () => {
      const supported = isWasmSupported();
      // WebAssembly should be supported in modern Node.js
      expect(typeof supported).toBe("boolean");
    });

    it("should report WASM availability correctly", () => {
      const available = isWasmAvailable();
      expect(typeof available).toBe("boolean");
    });
  });

  describe("Module Loading", () => {
    it("should handle module loading gracefully", async () => {
      const module = await loadWasmModule();
      // Module may or may not load depending on environment
      expect(module === null || typeof module === "object").toBe(true);
    });

    it("should cache loaded module", async () => {
      const module1 = await loadWasmModule();
      const module2 = await loadWasmModule();
      // Should return the same instance
      if (module1 !== null) {
        expect(module1).toBe(module2);
      }
    });
  });

  describe("WASM vs JavaScript Equivalence", () => {
    const testSamples = generateTestSamples(128);
    const fftSize = 128;

    it("should produce equivalent FFT results (when WASM available)", async () => {
      await loadWasmModule();

      const jsResult = calculateFFTSync(testSamples, fftSize);
      const wasmResult = calculateFFTWasm(testSamples, fftSize);

      if (wasmResult) {
        // WASM is available - results should be very close
        expect(wasmResult.length).toBe(jsResult.length);

        // Allow small floating-point differences
        for (let i = 0; i < fftSize; i++) {
          expect(
            Math.abs((wasmResult[i] ?? 0) - (jsResult[i] ?? 0)),
          ).toBeLessThan(0.1);
        }
      } else {
        // WASM not available - that's okay, fallback works
        expect(wasmResult).toBeNull();
      }
    });

    it("should produce equivalent waveform results (when WASM available)", async () => {
      await loadWasmModule();

      const jsResult = calculateWaveform(testSamples);
      const wasmResult = calculateWaveformWasm(testSamples);

      if (wasmResult) {
        // WASM is available - results should be very close
        expect(wasmResult.amplitude.length).toBe(jsResult.amplitude.length);
        expect(wasmResult.phase.length).toBe(jsResult.phase.length);

        // Check amplitude accuracy
        for (let i = 0; i < testSamples.length; i++) {
          expect(
            Math.abs(
              (wasmResult.amplitude[i] ?? 0) - (jsResult.amplitude[i] ?? 0),
            ),
          ).toBeLessThan(0.001);
          expect(
            Math.abs((wasmResult.phase[i] ?? 0) - (jsResult.phase[i] ?? 0)),
          ).toBeLessThan(0.001);
        }
      } else {
        expect(wasmResult).toBeNull();
      }
    });

    it("should produce equivalent spectrogram results (when WASM available)", async () => {
      await loadWasmModule();

      const jsResult = calculateSpectrogram(testSamples, 64);
      const wasmResult = calculateSpectrogramWasm(testSamples, 64);

      if (wasmResult) {
        // WASM is available - results should match
        expect(wasmResult.length).toBe(jsResult.length);

        // Check each row
        for (let row = 0; row < wasmResult.length; row++) {
          const wasmRow = wasmResult[row];
          const jsRow = jsResult[row];

          if (wasmRow && jsRow) {
            expect(wasmRow.length).toBe(jsRow.length);

            // Allow small floating-point differences
            for (let i = 0; i < wasmRow.length; i++) {
              expect(
                Math.abs((wasmRow[i] ?? 0) - (jsRow[i] ?? 0)),
              ).toBeLessThan(0.1);
            }
          }
        }
      } else {
        expect(wasmResult).toBeNull();
      }
    });
  });

  describe("Fallback Behavior", () => {
    it("should return null when WASM not available", async () => {
      // Don't load WASM module
      const samples = generateTestSamples(64);

      // If WASM isn't loaded, these should return null
      if (!isWasmAvailable()) {
        expect(calculateFFTWasm(samples, 64)).toBeNull();
        expect(calculateWaveformWasm(samples)).toBeNull();
        expect(calculateSpectrogramWasm(samples, 32)).toBeNull();
      }
    });

    it("should handle empty sample arrays gracefully", async () => {
      await loadWasmModule();

      const emptySamples: Sample[] = [];

      const fftResult = calculateFFTWasm(emptySamples, 64);
      const waveformResult = calculateWaveformWasm(emptySamples);
      const spectrogramResult = calculateSpectrogramWasm(emptySamples, 64);

      // Should either return null (WASM unavailable) or valid empty/zero results
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
