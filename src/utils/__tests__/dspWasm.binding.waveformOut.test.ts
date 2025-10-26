import {
  calculateWaveformWasm,
  setWasmModuleForTest,
  resetWasmModuleForTest,
  type WasmDSPModule,
} from "../dspWasm";
import type { Sample } from "../dsp";

function genSamples(n: number): Sample[] {
  const out: Sample[] = [];
  for (let i = 0; i < n; i++) out.push({ I: i + 1, Q: i + 2 });
  return out;
}

describe("dspWasm waveform binding (return-by-value)", () => {
  beforeEach(() => {
    resetWasmModuleForTest();
    window.localStorage.removeItem("radio.wasm.enabled");
  });
  afterEach(() => resetWasmModuleForTest());

  it("uses calculateWaveformOut when present and splits flat array", () => {
    const count = 5;
    const samples = genSamples(count);

    const flat = new Float32Array(count * 2);
    for (let i = 0; i < count; i++) {
      flat[i] = i * 10 + 1; // amplitude
      flat[count + i] = i * 10 + 2; // phase
    }

    const calculateWaveformOut = jest.fn(() => flat);

    const fake: WasmDSPModule = {
      allocateFloat32Array: (size) => new Float32Array(size),
      calculateFFT: () => undefined,
      calculateWaveform: () => undefined,
      calculateWaveformOut,
      calculateSpectrogram: () => undefined,
    };

    setWasmModuleForTest(fake, true);

    const result = calculateWaveformWasm(samples);
    expect(result).not.toBeNull();
    expect(result?.amplitude.length).toBe(count);
    expect(result?.phase.length).toBe(count);
    expect(Array.from(result!.amplitude)).toEqual(
      Array.from(flat.slice(0, count)),
    );
    expect(Array.from(result!.phase)).toEqual(
      Array.from(flat.slice(count, count * 2)),
    );
    expect(calculateWaveformOut).toHaveBeenCalledTimes(1);
  });
});
