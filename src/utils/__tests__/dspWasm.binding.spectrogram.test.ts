import {
  calculateSpectrogramWasm,
  setWasmModuleForTest,
  resetWasmModuleForTest,
  type WasmDSPModule,
} from "../dspWasm";
import type { Sample } from "../dsp";

function genSamples(n: number): Sample[] {
  const out: Sample[] = [];
  for (let i = 0; i < n; i++) {
    // Simple ramp IQ just to populate inputs; values are irrelevant for this binding test
    out.push({ I: i, Q: -i });
  }
  return out;
}

describe("dspWasm spectrogram binding (return-by-value)", () => {
  beforeEach(() => {
    resetWasmModuleForTest();
    // Ensure runtime is enabled by default (no localStorage flag)
    window.localStorage.removeItem("radio.wasm.enabled");
  });

  afterEach(() => {
    resetWasmModuleForTest();
  });

  it("uses calculateSpectrogramOut when present and returns row-sliced data", () => {
    const fftSize = 8;
    const rowCount = 3;
    const total = fftSize * rowCount;
    const samples = genSamples(total);

    // Flat result with recognizable pattern: 0..total-1
    const flat = new Float32Array(total);
    for (let i = 0; i < total; i++) flat[i] = i;

    const calculateSpectrogramOut = jest.fn(() => flat);
    const calculateSpectrogramLegacy = jest.fn(); // should NOT be called

    const fake: WasmDSPModule = {
      allocateFloat32Array: (size) => new Float32Array(size),
      calculateFFT: () => undefined,
      calculateWaveform: () => undefined,
      calculateSpectrogram:
        calculateSpectrogramLegacy as unknown as WasmDSPModule["calculateSpectrogram"],
      calculateSpectrogramOut,
    };

    setWasmModuleForTest(fake, true);

    const rows = calculateSpectrogramWasm(samples, fftSize);

    expect(rows).not.toBeNull();
    expect(rows?.length).toBe(rowCount);
    expect(calculateSpectrogramOut).toHaveBeenCalledTimes(1);
    expect(calculateSpectrogramLegacy).not.toHaveBeenCalled();

    for (let r = 0; r < rowCount; r++) {
      const seg = flat.slice(r * fftSize, (r + 1) * fftSize);
      expect(rows?.[r]).toBeInstanceOf(Float32Array);
      expect(Array.from(rows?.[r] ?? [])).toEqual(Array.from(seg));
    }
  });
});
