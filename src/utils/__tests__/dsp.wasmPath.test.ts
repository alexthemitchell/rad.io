/**
 * Additional coverage tests for DSP WASM paths
 */

// Mock the dspWasm module to force WASM availability
jest.mock("../dspWasm", () => {
  return {
    isWasmAvailable: () => true,
    isWasmRuntimeEnabled: () => true,
    isWasmValidationEnabled: () => true,
    calculateFFTWasm: jest.fn((_samples: unknown, fftSize: number) => {
      const arr = new Float32Array(fftSize);
      arr.fill(0);
      return arr;
    }),
    calculateSpectrogramWasm: jest.fn((_samples: unknown, fftSize: number) => [
      (() => {
        const arr = new Float32Array(fftSize);
        arr.fill(0);
        return arr;
      })(),
    ]),
    calculateWaveformWasm: jest.fn(
      (samples: Array<{ I: number; Q: number }>) => {
        return {
          amplitude: new Float32Array(samples.length).fill(0),
          phase: new Float32Array(samples.length).fill(0),
        };
      },
    ),
  };
});

import {
  calculateFFTSync,
  calculateSpectrogram,
  calculateWaveform,
  type Sample,
} from "../dsp";

function makeSamples(n: number): Sample[] {
  return Array.from({ length: n }, (_, i) => ({
    I: Math.cos(i),
    Q: Math.sin(i),
  }));
}

describe("DSP WASM path coverage", () => {
  it("covers calculateFFTSync WASM branch", () => {
    const result = calculateFFTSync(makeSamples(8), 8);
    expect(result).toBeInstanceOf(Float32Array);
    expect(result.length).toBe(8);
  });

  it("covers calculateSpectrogram WASM branch", () => {
    const rows = calculateSpectrogram(makeSamples(16), 8);
    expect(Array.isArray(rows)).toBe(true);
    expect(rows[0]).toBeInstanceOf(Float32Array);
  });

  it("covers calculateWaveform WASM branch", () => {
    const out = calculateWaveform(makeSamples(4));
    expect(out.amplitude).toBeInstanceOf(Float32Array);
    expect(out.phase).toBeInstanceOf(Float32Array);
    expect(out.amplitude.length).toBe(4);
  });
});
