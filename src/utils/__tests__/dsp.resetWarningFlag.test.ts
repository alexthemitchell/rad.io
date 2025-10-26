import type { Sample } from "../dsp";

// Mock dspWasm to force a degenerate spectrogram output so the warning path
// in calculateSpectrogram() is exercised.
jest.mock("../dspWasm", () => ({
  isWasmAvailable: () => true,
  isWasmRuntimeEnabled: () => true,
  isWasmValidationEnabled: () => true,
  calculateFFTWasm: () => null,
  calculateSpectrogramWasm: (samples: Sample[], fftSize: number) => {
    const rows = Math.floor(samples.length / fftSize);
    const zeroRow = new Float32Array(fftSize);
    return Array.from({ length: rows }, () => zeroRow.slice());
  },
}));

// Mock logger to spy on dsp warning calls
const warnSpy = jest.fn();
jest.mock("../logger", () => {
  const actual = jest.requireActual("../logger");
  return {
    ...actual,
    dspLogger: {
      debug: jest.fn(),
      info: jest.fn(),
      warn: warnSpy,
      error: jest.fn(),
    },
  };
});

describe("resetSpectrogramWasmDegenerateWarning", () => {
  it("resets the warning flag so future degenerate outputs warn again", () => {
    // Import after mocks are set up
    const {
      calculateSpectrogram,
      resetSpectrogramWasmDegenerateWarning,
    } = require("../dsp");

    const fftSize = 32;
    const rows = 3;
    const total = fftSize * rows;
    const samples: Sample[] = Array.from({ length: total }, (_, i) => ({
      I: Math.sin((2 * Math.PI * (i % fftSize)) / fftSize),
      Q: Math.cos((2 * Math.PI * (i % fftSize)) / fftSize),
    }));

    // First call should trigger a single warning
    warnSpy.mockClear();
    calculateSpectrogram(samples, fftSize);
    expect(warnSpy).toHaveBeenCalledTimes(1);

    // Second call should not warn again (spam suppression)
    calculateSpectrogram(samples, fftSize);
    expect(warnSpy).toHaveBeenCalledTimes(1);

    // After reset, warning should be emitted again
    resetSpectrogramWasmDegenerateWarning();
    calculateSpectrogram(samples, fftSize);
    expect(warnSpy).toHaveBeenCalledTimes(2);
  });
});
