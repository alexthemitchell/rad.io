/**
 * WebAssembly DSP Module Loader
 * Provides high-performance FFT and signal processing via WASM
 * with automatic fallback to JavaScript implementation
 */

import { dspLogger } from "./logger";
import type { Sample } from "./dsp";

// WASM module interface
export interface WasmDSPModule {
  calculateFFT(
    iSamples: Float32Array,
    qSamples: Float32Array,
    fftSize: number,
    output: Float32Array,
  ): void;
  // Newer API: returns lifted Float32Array so JS receives results directly
  calculateFFTOut?: (
    iSamples: Float32Array,
    qSamples: Float32Array,
    fftSize: number,
  ) => Float32Array;
  calculateWaveform(
    iSamples: Float32Array,
    qSamples: Float32Array,
    amplitude: Float32Array,
    phase: Float32Array,
    count: number,
  ): void;
  // Newer API: returns flat Float32Array [amplitude..., phase...]
  calculateWaveformOut?: (
    iSamples: Float32Array,
    qSamples: Float32Array,
    count: number,
  ) => Float32Array;
  calculateSpectrogram(
    iSamples: Float32Array,
    qSamples: Float32Array,
    fftSize: number,
    output: Float32Array,
    rowCount: number,
  ): void;
  // Newer API: returns a flat Float32Array of length rowCount*fftSize
  calculateSpectrogramOut?: (
    iSamples: Float32Array,
    qSamples: Float32Array,
    fftSize: number,
    rowCount: number,
  ) => Float32Array;
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

/**
 * Build a summary of WASM module export presence for logging/diagnostics.
 */
function getWasmModuleExportStatus(mod: Partial<WasmDSPModule>): {
  calculateFFT: boolean;
  calculateFFTOut: boolean;
  calculateWaveform: boolean;
  calculateWaveformOut: boolean;
  calculateSpectrogram: boolean;
  calculateSpectrogramOut: boolean;
  allocateFloat32Array: boolean;
} {
  return {
    calculateFFT: typeof mod.calculateFFT === "function",
    calculateFFTOut: typeof mod.calculateFFTOut === "function",
    calculateWaveform: typeof mod.calculateWaveform === "function",
    calculateWaveformOut: typeof mod.calculateWaveformOut === "function",
    calculateSpectrogram: typeof mod.calculateSpectrogram === "function",
    calculateSpectrogramOut: typeof mod.calculateSpectrogramOut === "function",
    allocateFloat32Array: typeof mod.allocateFloat32Array === "function",
  };
}

// Module state
let wasmModule: WasmDSPModule | null = null;
let wasmLoading: Promise<WasmDSPModule | null> | null = null;
let wasmSupported = false;

// Test-only helpers to control internal module state
// These are no-ops in production usage but exported for unit tests to inject fakes.
export function setWasmModuleForTest(
  mod: WasmDSPModule | null,
  supported = true,
): void {
  wasmModule = mod;
  wasmSupported = mod !== null && supported;
}

export function resetWasmModuleForTest(): void {
  wasmModule = null;
  wasmLoading = null;
  wasmSupported = false;
}

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

  const makeUrl = (path: string): string => {
    const url = new URL(path, window.location.href);
    // In dev, add a stable cache-busting param for the browser session to avoid
    // re-downloading on every reload while still ensuring fresh loads across rebuilds.
    const host = window.location.hostname;
    const isLocalhost =
      host === "localhost" || host === "127.0.0.1" || host === "::1";
    if (isLocalhost) {
      try {
        const key = "radio.devBuildTs";
        const existing = window.sessionStorage.getItem(key);
        const stamp = existing ?? String(Date.now());
        if (!existing) {
          window.sessionStorage.setItem(key, stamp);
        }
        url.searchParams.set("v", stamp);
      } catch {
        // Fallback to per-load cache bust if sessionStorage unavailable
        url.searchParams.set("v", String(Date.now()));
      }
    }
    return url.toString();
  };

  const candidateUrls = [
    makeUrl("release.js"),
    makeUrl("/release.js"),
    makeUrl("dsp.js"),
    makeUrl("/dsp.js"),
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
        // Bind optional return-by-value API if present so callers can detect/use it
        if (typeof mod.calculateFFTOut === "function") {
          const bound: NonNullable<WasmDSPModule["calculateFFTOut"]> =
            mod.calculateFFTOut.bind(mod);
          wasmModule.calculateFFTOut = bound;
        }
        {
          const calc = (mod as Partial<WasmDSPModule>).calculateWaveformOut;
          if (typeof calc === "function") {
            wasmModule.calculateWaveformOut = calc.bind(mod as object);
          }
        }
        {
          const calc = (mod as Partial<WasmDSPModule>).calculateSpectrogramOut;
          if (typeof calc === "function") {
            wasmModule.calculateSpectrogramOut = calc.bind(mod as object);
          }
        }

        wasmSupported = true;
        // One-time visibility into loaded exports
        try {
          dspLogger.info("WASM module loaded", {
            url,
            exports: getWasmModuleExportStatus(mod),
          });
        } catch {
          // ignore logging errors
        }
        return wasmModule;
      } catch (error) {
        lastError = error;
      }
    }

    dspLogger.warn("Failed to load WASM module, falling back to JavaScript", {
      attemptedPaths: ["../assembly/dsp", "./wasm-build/dsp"],
      wasmSupported: typeof WebAssembly !== "undefined",
      errorType: lastError instanceof Error ? lastError.name : typeof lastError,
    });
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
 * Runtime toggle to enable/disable WASM usage without changing build.
 * Defaults to enabled. Can be overridden via localStorage key:
 *   localStorage.setItem('radio.wasm.enabled', 'false')
 */
export function isWasmRuntimeEnabled(): boolean {
  try {
    // In non-browser environments (tests, SSR), default to enabled
    if (typeof window === "undefined" || !("localStorage" in window)) {
      return true;
    }
    const v = window.localStorage.getItem("radio.wasm.enabled");
    if (v === null) {
      return true;
    }
    // any value other than literal 'false' means enabled
    return v !== "false";
  } catch {
    return true;
  }
}

/**
 * Optional runtime validation of WASM FFT outputs.
 *
 * The validation detects degenerate spectra (all zeros/constant or non-finite)
 * and triggers a JS fallback to ensure meaningful results. This adds an O(N)
 * pass over the FFT output. Enable by default in development; disable by
 * default in production, but can be overridden at runtime via:
 *   localStorage.setItem('radio.wasm.validate', 'true' | 'false')
 */
export function isWasmValidationEnabled(): boolean {
  try {
    // Node/test or SSR: default to enabled so tests can exercise validation
    const isProd = process.env["NODE_ENV"] === "production";
    if (typeof window === "undefined" || !("localStorage" in window)) {
      return !isProd;
    }
    const v = window.localStorage.getItem("radio.wasm.validate");
    if (v === null) {
      // Default to true in dev, false in prod
      return !isProd;
    }
    return v !== "false";
  } catch {
    return true;
  }
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
    // Separate I and Q components in WASM memory to ensure the WASM function
    // can read them reliably (avoids JS↔WASM typed array copy issues).
    const iSamples = wasmModule.allocateFloat32Array(fftSize);
    const qSamples = wasmModule.allocateFloat32Array(fftSize);

    const count = Math.min(samples.length, fftSize);
    for (let i = 0; i < count; i++) {
      const sample = samples[i];
      if (sample) {
        iSamples[i] = sample.I;
        qSamples[i] = sample.Q;
      }
    }

    // Prefer return-by-value API if available (avoids copy-back issue)
    if (typeof wasmModule.calculateFFTOut === "function") {
      dspLogger.debug("Using calculateFFTOut (return-by-value)");
      return wasmModule.calculateFFTOut(iSamples, qSamples, fftSize);
    }

    // Fallback to output-parameter API; note that some loader versions
    // do not copy results back to JS when passing an output array.
    // We'll still use it and rely on higher-level sanity checks/fallbacks.
    dspLogger.debug("Using calculateFFT with output parameter");
    const output = wasmModule.allocateFloat32Array(fftSize);
    wasmModule.calculateFFT(iSamples, qSamples, fftSize, output);
    return output;
  } catch (error) {
    dspLogger.warn(
      "FFT calculation failed, falling back to JS implementation",
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

    // Separate I and Q components in WASM memory
    const iSamples = wasmModule.allocateFloat32Array(count);
    const qSamples = wasmModule.allocateFloat32Array(count);

    for (let i = 0; i < count; i++) {
      const sample = samples[i];
      if (sample) {
        iSamples[i] = sample.I;
        qSamples[i] = sample.Q;
      }
    }

    // Prefer return-by-value if available
    if (typeof wasmModule.calculateWaveformOut === "function") {
      dspLogger.debug("Using calculateWaveformOut (return-by-value)");
      const flat = wasmModule.calculateWaveformOut(iSamples, qSamples, count);
      // Split into amplitude and phase views
      const amplitude = flat.subarray(0, count);
      const phase = flat.subarray(count, count * 2);
      return { amplitude, phase };
    }

    // Legacy path: allocate output arrays and let WASM fill them
    const amplitude = wasmModule.allocateFloat32Array(count);
    const phase = wasmModule.allocateFloat32Array(count);
    wasmModule.calculateWaveform(iSamples, qSamples, amplitude, phase, count);
    return { amplitude, phase };
  } catch (error) {
    dspLogger.warn(
      "Waveform calculation failed, falling back to JS implementation",
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
    const iSamples = wasmModule.allocateFloat32Array(totalSamples);
    const qSamples = wasmModule.allocateFloat32Array(totalSamples);

    for (let i = 0; i < totalSamples; i++) {
      const sample = samples[i];
      if (sample) {
        iSamples[i] = sample.I;
        qSamples[i] = sample.Q;
      }
    }

    // Prefer return-by-value API if available to avoid copy-back issue
    if (typeof wasmModule.calculateSpectrogramOut === "function") {
      dspLogger.debug("Using calculateSpectrogramOut (return-by-value)");
      const flat = wasmModule.calculateSpectrogramOut(
        iSamples,
        qSamples,
        fftSize,
        rowCount,
      );
      const rows: Float32Array[] = [];
      for (let row = 0; row < rowCount; row++) {
        rows.push(flat.slice(row * fftSize, (row + 1) * fftSize));
      }
      return rows;
    }

    // Allocate output array in WASM memory and call legacy API
    dspLogger.debug("Using calculateSpectrogram with output parameter");
    const output = wasmModule.allocateFloat32Array(rowCount * fftSize);
    wasmModule.calculateSpectrogram(
      iSamples,
      qSamples,
      fftSize,
      output,
      rowCount,
    );

    const rows: Float32Array[] = [];
    for (let row = 0; row < rowCount; row++) {
      rows.push(output.slice(row * fftSize, (row + 1) * fftSize));
    }
    return rows;
  } catch (error) {
    dspLogger.warn(
      "Spectrogram calculation failed, falling back to JS implementation",
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
