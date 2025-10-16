/**
 * WebAssembly DSP Module Loader
 * Provides high-performance FFT and signal processing via WASM
 * with automatic fallback to JavaScript implementation
 */

import type { Sample } from "./dsp";

// WASM module interface
interface WasmDSPModule {
  calculateFFT(
    iSamples: Float32Array,
    qSamples: Float32Array,
    fftSize: number,
    output: Float32Array,
  ): void;
  calculateWaveform(
    iSamples: Float32Array,
    qSamples: Float32Array,
    amplitude: Float32Array,
    phase: Float32Array,
    count: number,
  ): void;
  calculateSpectrogram(
    iSamples: Float32Array,
    qSamples: Float32Array,
    fftSize: number,
    output: Float32Array,
    rowCount: number,
  ): void;
}

// Module state
let wasmModule: WasmDSPModule | null = null;
let wasmLoading: Promise<WasmDSPModule | null> | null = null;
let wasmSupported = false;

const dynamicImportModule: (specifier: string) => Promise<unknown> =
  typeof Function === "function"
    ? (new Function(
        "specifier",
        "return import(specifier);",
      ) as (specifier: string) => Promise<unknown>)
    : async (): Promise<unknown> => {
        throw new Error("Dynamic import is not supported in this environment");
      };

/**
 * Check if WebAssembly is supported in this environment
 */
export function isWasmSupported(): boolean {
  return (
    typeof WebAssembly !== "undefined" &&
    typeof WebAssembly.instantiate === "function"
  );
}

/**
 * Load and initialize the WASM module
 * Returns a promise that resolves when the module is ready
 */
export async function loadWasmModule(): Promise<WasmDSPModule | null> {
  // Return cached module if already loaded
  if (wasmModule) {
    return wasmModule;
  }

  // Return existing loading promise if in progress
  if (wasmLoading) {
    try {
      return await wasmLoading;
    } catch {
      return null;
    }
  }

  // Check if WASM is supported
  if (!isWasmSupported() || typeof window === "undefined") {
    wasmSupported = false;
    return null;
  }

  const moduleUrl = new URL("/dsp.js", window.location.href).toString();

  const loadPromise = (async (): Promise<WasmDSPModule | null> => {
    try {
  const mod = (await dynamicImportModule(moduleUrl)) as Partial<WasmDSPModule>;
      if (
        typeof mod.calculateFFT !== "function" ||
        typeof mod.calculateWaveform !== "function" ||
        typeof mod.calculateSpectrogram !== "function"
      ) {
        throw new Error("Invalid WASM module exports");
      }

      wasmModule = {
        calculateFFT: mod.calculateFFT,
        calculateWaveform: mod.calculateWaveform,
        calculateSpectrogram: mod.calculateSpectrogram,
      } as WasmDSPModule;
      wasmSupported = true;
      return wasmModule;
    } catch (error) {
      console.warn(
        "Failed to load WASM module, falling back to JavaScript:",
        error,
      );
      wasmModule = null;
      wasmSupported = false;
      return null;
    }
  })();

  wasmLoading = loadPromise.then((module) => {
    wasmLoading = null;
    return module;
  });

  try {
    return await wasmLoading;
  } catch {
    wasmLoading = null;
    return null;
  }
}

/**
 * Check if WASM module is currently available
 */
export function isWasmAvailable(): boolean {
  return wasmModule !== null && wasmSupported;
}

/**
 * Calculate FFT using WASM if available
 * Converts Sample[] format to separate I/Q arrays for WASM
 */
export function calculateFFTWasm(
  samples: Sample[],
  fftSize: number,
): Float32Array | null {
  if (!isWasmAvailable() || !wasmModule) {
    return null;
  }

  try {
    // Separate I and Q components
    const iSamples = new Float32Array(fftSize);
    const qSamples = new Float32Array(fftSize);

    const count = Math.min(samples.length, fftSize);
    for (let i = 0; i < count; i++) {
      const sample = samples[i];
      if (sample) {
        iSamples[i] = sample.I;
        qSamples[i] = sample.Q;
      }
    }

    // Allocate output
    const output = new Float32Array(fftSize);

    // Call WASM function
    wasmModule.calculateFFT(iSamples, qSamples, fftSize, output);

    return output;
  } catch (error) {
    console.warn("WASM FFT calculation failed, falling back to JS:", error);
    return null;
  }
}

/**
 * Calculate waveform using WASM if available
 */
export function calculateWaveformWasm(
  samples: Sample[],
): { amplitude: Float32Array; phase: Float32Array } | null {
  if (!isWasmAvailable() || !wasmModule) {
    return null;
  }

  try {
    const count = samples.length;

    // Separate I and Q components
    const iSamples = new Float32Array(count);
    const qSamples = new Float32Array(count);

    for (let i = 0; i < count; i++) {
      const sample = samples[i];
      if (sample) {
        iSamples[i] = sample.I;
        qSamples[i] = sample.Q;
      }
    }

    // Allocate outputs
    const amplitude = new Float32Array(count);
    const phase = new Float32Array(count);

    // Call WASM function
    wasmModule.calculateWaveform(iSamples, qSamples, amplitude, phase, count);

    return { amplitude, phase };
  } catch (error) {
    console.warn(
      "WASM waveform calculation failed, falling back to JS:",
      error,
    );
    return null;
  }
}

/**
 * Calculate spectrogram using WASM if available
 */
export function calculateSpectrogramWasm(
  samples: Sample[],
  fftSize: number,
): Float32Array[] | null {
  if (!isWasmAvailable() || !wasmModule) {
    return null;
  }

  try {
    const rowCount = Math.floor(samples.length / fftSize);
    if (rowCount === 0) {
      return null;
    }

    // Separate I and Q components
    const totalSamples = rowCount * fftSize;
    const iSamples = new Float32Array(totalSamples);
    const qSamples = new Float32Array(totalSamples);

    for (let i = 0; i < totalSamples; i++) {
      const sample = samples[i];
      if (sample) {
        iSamples[i] = sample.I;
        qSamples[i] = sample.Q;
      }
    }

    // Allocate output (flat array for all rows)
    const output = new Float32Array(rowCount * fftSize);

    // Call WASM function
    wasmModule.calculateSpectrogram(
      iSamples,
      qSamples,
      fftSize,
      output,
      rowCount,
    );

    // Convert flat array to array of rows
    const rows: Float32Array[] = [];
    for (let row = 0; row < rowCount; row++) {
      rows.push(output.slice(row * fftSize, (row + 1) * fftSize));
    }

    return rows;
  } catch (error) {
    console.warn(
      "WASM spectrogram calculation failed, falling back to JS:",
      error,
    );
    return null;
  }
}

/**
 * Preload WASM module on app initialization
 * Call this early to ensure WASM is ready when needed
 */
export function preloadWasmModule(): void {
  // Don't block - load in background
  loadWasmModule().catch(() => {
    // Silent fail - fallback will be used
  });
}
