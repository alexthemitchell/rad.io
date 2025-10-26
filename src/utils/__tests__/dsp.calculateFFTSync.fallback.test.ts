import { calculateFFTSync, type Sample } from "../dsp";

// Mock the WASM module to simulate a degenerate FFT output (all zeros),
// which should trigger the JS fallback path inside calculateFFTSync.
jest.mock("../dspWasm", () => ({
  isWasmAvailable: () => true,
  isWasmRuntimeEnabled: () => true,
  isWasmValidationEnabled: () => true,
  calculateFFTWasm: (_samples: Sample[], fftSize: number) =>
    new Float32Array(fftSize),
  calculateSpectrogramWasm: jest.fn(),
}));

describe("calculateFFTSync fallback behavior", () => {
  it("falls back to JS when WASM returns a degenerate (zero) spectrum and produces a non-constant result", () => {
    const fftSize = 256;

    // Generate a simple complex sinusoid at bin k0
    const k0 = 16;
    const twoPiOverN = (2 * Math.PI) / fftSize;

    const samples: Sample[] = Array.from({ length: fftSize }, (_, n) => ({
      I: Math.cos(twoPiOverN * k0 * n),
      Q: Math.sin(twoPiOverN * k0 * n),
    }));

    const spectrum = calculateFFTSync(samples, fftSize);

    // The JS path should yield a non-constant dB spectrum
    let min = Infinity;
    let max = -Infinity;
    for (const v of spectrum) {
      if (!Number.isFinite(v)) continue;
      if (v < min) min = v;
      if (v > max) max = v;
    }

    expect(spectrum.length).toBe(fftSize);
    expect(max - min).toBeGreaterThan(1e-3);
  });
});
