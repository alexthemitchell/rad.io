import { calculateSpectrogram, type Sample } from "../dsp";

// Mock dspWasm to simulate degenerate spectrogram WASM output but valid FFT WASM rows.
jest.mock("../dspWasm", () => ({
  isWasmAvailable: () => true,
  isWasmRuntimeEnabled: () => true,
  // Degenerate bulk spectrogram (all zeros) to trigger row-wise fallback
  calculateSpectrogramWasm: (samples: Sample[], fftSize: number) => {
    const rows = Math.floor(samples.length / fftSize);
    const zeroRow = new Float32Array(fftSize);
    return Array.from({ length: rows }, () => zeroRow.slice());
  },
  // Valid per-row FFT via return-by-value API used by calculateFFTWasm wrapper
  calculateFFTWasm: (_samples: Sample[], fftSize: number) => {
    const out = new Float32Array(fftSize);
    // Put a distinct peak at the center bin to ensure non-degenerate range
    const center = Math.floor(fftSize / 2);
    out[center] = 10; // 10 dB peak
    return out;
  },
}));

describe("calculateSpectrogram - row-wise WASM fallback", () => {
  it("uses per-row WASM FFT when bulk spectrogram output is degenerate", () => {
    const fftSize = 64;
    const rows = 3;
    const total = fftSize * rows;
    // Create simple periodic I/Q samples
    const samples: Sample[] = Array.from({ length: total }, (_, i) => ({
      I: Math.sin((2 * Math.PI * (i % fftSize)) / fftSize),
      Q: Math.cos((2 * Math.PI * (i % fftSize)) / fftSize),
    }));

    const spectro = calculateSpectrogram(samples, fftSize);

    expect(spectro.length).toBe(rows);
    expect(spectro[0]).toBeInstanceOf(Float32Array);
    expect(spectro[0]!.length).toBe(fftSize);

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
