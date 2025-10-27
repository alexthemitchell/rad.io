import {
  calculateFFTWasm,
  isWasmAvailable,
  isWasmRuntimeEnabled,
  setWasmModuleForTest,
  resetWasmModuleForTest,
  type WasmDSPModule,
} from "../dspWasm";
import type { Sample } from "../dsp";

function genSamples(n: number): Sample[] {
  const out: Sample[] = [];
  for (let i = 0; i < n; i++) {
    const t = i / n;
    out.push({ I: Math.cos(2 * Math.PI * t), Q: Math.sin(2 * Math.PI * t) });
  }
  return out;
}

describe("dspWasm binding & runtime behavior", () => {
  beforeEach(() => {
    resetWasmModuleForTest();
    // Ensure runtime is enabled by default (no localStorage flag)
    window.localStorage.removeItem("radio.wasm.enabled");
  });

  afterEach(() => {
    resetWasmModuleForTest();
  });

  it("uses return-by-value path when calculateFFTOut is present", () => {
    const fftSize = 64;
    const samples = genSamples(fftSize);

    const outArray = new Float32Array(fftSize).map((_, i) => i);

    const calculateFFTOut = jest.fn(() => outArray);
    const calculateFFT = jest.fn(); // should NOT be called

    const fake: WasmDSPModule = {
      allocateFloat32Array: (size) => new Float32Array(size),
      calculateFFT,
      calculateFFTOut,
      // Unused in this test
      calculateWaveform: () => {},
      calculateSpectrogram: () => {},
      applyHannWindow: () => {},
      applyHammingWindow: () => {},
      applyBlackmanWindow: () => {},
    };

    setWasmModuleForTest(fake, true);

    expect(isWasmAvailable()).toBe(true);

    const result = calculateFFTWasm(samples, fftSize);

    expect(result).not.toBeNull();
    expect(result?.length).toBe(fftSize);
    expect(calculateFFTOut).toHaveBeenCalledTimes(1);
    expect(calculateFFT).not.toHaveBeenCalled();
    // result should be the exact array returned by the wasm function
    expect(result).toBe(outArray);
  });

  it("falls back to output-parameter path when calculateFFTOut is absent", () => {
    const fftSize = 32;
    const samples = genSamples(fftSize);

    const calculateFFTMock = jest.fn(
      (
        _i: Float32Array,
        _q: Float32Array,
        _n: number,
        output: Float32Array,
      ) => {
        for (let i = 0; i < output.length; i++) output[i] = 42;
      },
    );
    const calculateFFT =
      calculateFFTMock as unknown as WasmDSPModule["calculateFFT"];

    const fake: WasmDSPModule = {
      allocateFloat32Array: (size) => new Float32Array(size),
      calculateFFT,
      // No calculateFFTOut here on purpose
      calculateWaveform: () => undefined,
      calculateSpectrogram: () => undefined,
      applyHannWindow: () => {},
      applyHammingWindow: () => {},
      applyBlackmanWindow: () => {},
    };

    setWasmModuleForTest(fake, true);

    const result = calculateFFTWasm(samples, fftSize);
    expect(result).not.toBeNull();
    expect(result?.length).toBe(fftSize);
    expect(calculateFFTMock).toHaveBeenCalledTimes(1);
    // Ensure data came from the output array we filled
    expect(result?.every((v) => v === 42)).toBe(true);
  });

  it("returns null on wasm exception and does not throw", () => {
    const fftSize = 16;
    const samples = genSamples(fftSize);

    const fake: WasmDSPModule = {
      allocateFloat32Array: (size) => new Float32Array(size),
      calculateFFT: () => undefined,
      calculateFFTOut: () => {
        throw new Error("bang");
      },
      calculateWaveform: () => undefined,
      calculateSpectrogram: () => undefined,
      applyHannWindow: () => {},
      applyHammingWindow: () => {},
      applyBlackmanWindow: () => {},
    };

    setWasmModuleForTest(fake, true);

    expect(() => calculateFFTWasm(samples, fftSize)).not.toThrow();
    expect(calculateFFTWasm(samples, fftSize)).toBeNull();
  });

  it("honors runtime toggle via localStorage", () => {
    // Default: enabled when key is absent
    expect(isWasmRuntimeEnabled()).toBe(true);

    // Explicit false disables
    window.localStorage.setItem("radio.wasm.enabled", "false");
    expect(isWasmRuntimeEnabled()).toBe(false);

    // Any other value enables
    window.localStorage.setItem("radio.wasm.enabled", "true");
    expect(isWasmRuntimeEnabled()).toBe(true);
    window.localStorage.setItem("radio.wasm.enabled", "garbage");
    expect(isWasmRuntimeEnabled()).toBe(true);
  });
});
