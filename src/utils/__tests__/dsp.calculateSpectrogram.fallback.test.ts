import { calculateSpectrogram, type Sample } from "../dsp";

// Mock dspWasm to simulate the AssemblyScript output-parameter bug where
// spectrogram rows come back degenerate (all zeros or constant), which should
// trigger the JS fallback path in calculateSpectrogram().
jest.mock("../dspWasm", () => ({
  isWasmAvailable: () => true,
  isWasmRuntimeEnabled: () => true,
  isWasmValidationEnabled: () => true,
  // Ensure calculateFFTWasm exists so calculateFFTSync can safely fall back to JS when it returns null
  calculateFFTWasm: () => null,
  // Return constant rows with correct shape to emulate degenerate output
  calculateSpectrogramWasm: (samples: Sample[], fftSize: number) => {
    const rows = Math.floor(samples.length / fftSize);
    if (rows <= 0) return [] as Float32Array[];
    const constant = new Float32Array(fftSize);
    // All zeros => range = 0 (degenerate)
    const out: Float32Array[] = [];
    for (let r = 0; r < rows; r++) {
      out.push(constant.slice());
    }
    return out;
  },
}));

describe("calculateSpectrogram - WASM degeneracy fallback", () => {
  it("falls back to JS implementation when WASM output is degenerate", () => {
    const fftSize = 64;
    // Create simple ramp IQ samples to ensure non-trivial JS FFT result
    const total = fftSize * 4; // 4 rows
    const samples: Sample[] = Array.from({ length: total }, (_, i) => ({
      I: Math.sin((2 * Math.PI * (i % fftSize)) / fftSize),
      Q: Math.cos((2 * Math.PI * (i % fftSize)) / fftSize),
    }));

    const spectro = calculateSpectrogram(samples, fftSize);

    // Expect non-empty result with correct shape
    expect(spectro.length).toBeGreaterThan(0);
    expect(spectro[0]).toBeInstanceOf(Float32Array);
    expect(spectro[0]!.length).toBe(fftSize);

    // Validate it's not degenerate (range > 0)
    let min = Infinity;
    let max = -Infinity;
    for (const row of spectro) {
      for (const v of row) {
        if (Number.isFinite(v)) {
          if (v < min) min = v;
          if (v > max) max = v;
        }
      }
    }
    expect(max - min).toBeGreaterThan(1e-3);
  });
});
