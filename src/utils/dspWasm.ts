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
  allocateFloat32Array(size: number): Float32Array;
}

function isValidModule(mod: Partial<WasmDSPModule>): mod is WasmDSPModule {
  return (
    typeof mod.calculateFFT === "function" &&
    typeof mod.calculateWaveform === "function" &&
    typeof mod.calculateSpectrogram === "function" &&
    typeof mod.allocateFloat32Array === "function"
  );
}

// Module state
let wasmModule: WasmDSPModule | null = null;
let wasmLoading: Promise<WasmDSPModule | null> | null = null;
let wasmSupported = false;

// Dynamic import wrapper - necessary for WebAssembly module loading
const dynamicImportModule: (specifier: string) => Promise<unknown> =
  typeof Function === "function"
    ? // eslint-disable-next-line @typescript-eslint/no-implied-eval -- Required for dynamic imports
      (new Function("specifier", "return import(specifier);") as (
        specifier: string,
      ) => Promise<unknown>)
    : async (): Promise<unknown> => {
        return Promise.reject(
          new Error("Dynamic import is not supported in this environment"),
        );
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

  const candidateUrls = [
    new URL("release.js", window.location.href).toString(),
    new URL("/release.js", window.location.origin).toString(),
    new URL("dsp.js", window.location.href).toString(),
    new URL("/dsp.js", window.location.origin).toString(),
  ];

  const loadPromise = (async (): Promise<WasmDSPModule | null> => {
    let lastError: unknown;

    for (const url of candidateUrls) {
      try {
        const mod = (await dynamicImportModule(url)) as Partial<WasmDSPModule>;
        if (!isValidModule(mod)) {
          throw new Error("Invalid WASM module exports");
        }

        wasmModule = {
          calculateFFT: mod.calculateFFT.bind(mod),
          calculateWaveform: mod.calculateWaveform.bind(mod),
          calculateSpectrogram: mod.calculateSpectrogram.bind(mod),
          allocateFloat32Array: mod.allocateFloat32Array.bind(mod),
        };
        wasmSupported = true;
        return wasmModule;
      } catch (error) {
        lastError = error;
      }
    }

    console.warn(
      "dspWasm: Failed to load WASM module, falling back to JavaScript",
      lastError,
      {
        attemptedPaths: ["../assembly/dsp", "./wasm-build/dsp"],
        wasmSupported: typeof WebAssembly !== "undefined",
        errorType:
          lastError instanceof Error ? lastError.name : typeof lastError,
      },
    );
    wasmModule = null;
    wasmSupported = false;
    return null;
  })();

  wasmLoading = loadPromise.then((module) => {
    wasmLoading = null;
    return module;
  });

  return wasmLoading;
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

    // Allocate output array in WASM memory
    const output = wasmModule.allocateFloat32Array(fftSize);

    // Call WASM function
    wasmModule.calculateFFT(iSamples, qSamples, fftSize, output);

    return output;
  } catch (error) {
    console.warn(
      "dspWasm: FFT calculation failed, falling back to JS implementation",
      error,
      {
        fftSize,
        inputSampleCount: samples.length,
        errorType: error instanceof Error ? error.name : typeof error,
      },
    );
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

    // Allocate output arrays in WASM memory
    // This ensures the WASM function can write to them and we get the results back
    const amplitude = wasmModule.allocateFloat32Array(count);
    const phase = wasmModule.allocateFloat32Array(count);

    // Call WASM function
    // The function modifies amplitude and phase arrays in WASM memory
    wasmModule.calculateWaveform(iSamples, qSamples, amplitude, phase, count);

    // Return the WASM-allocated arrays (they're already views of WASM memory with results)
    return { amplitude, phase };
  } catch (error) {
    console.warn(
      "dspWasm: Waveform calculation failed, falling back to JS implementation",
      error,
      {
        inputLength: samples.length,
        errorType: error instanceof Error ? error.name : typeof error,
      },
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

    // Allocate output array in WASM memory
    const output = wasmModule.allocateFloat32Array(rowCount * fftSize);

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
      "dspWasm: Spectrogram calculation failed, falling back to JS implementation",
      error,
      {
        fftSize,
        inputLength: samples.length,
        errorType: error instanceof Error ? error.name : typeof error,
      },
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
