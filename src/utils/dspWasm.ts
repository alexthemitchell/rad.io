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
  /**
   * Newer API: returns a flat Float32Array in row-major order.
   * Length is rowCount * fftSize; row i occupies indices [i*fftSize, (i+1)*fftSize).
   */
  calculateSpectrogramOut?: (
    iSamples: Float32Array,
    qSamples: Float32Array,
    fftSize: number,
    rowCount: number,
  ) => Float32Array;
  allocateFloat32Array(size: number): Float32Array;
  applyHannWindow(
    iSamples: Float32Array,
    qSamples: Float32Array,
    size: number,
  ): void;
  applyHammingWindow(
    iSamples: Float32Array,
    qSamples: Float32Array,
    size: number,
  ): void;
  applyBlackmanWindow(
    iSamples: Float32Array,
    qSamples: Float32Array,
    size: number,
  ): void;
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
// One-time log flags to avoid flooding console on hot paths
let loggedFFTChoice = false;
let loggedWaveformChoice = false;
let loggedSpectrogramChoice = false;

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
 * Build a URL for loading the WASM JS glue with sensible dev caching behavior.
 * In local development (localhost/127.0.0.1/::1), we add a stable session-scoped
 * cache-busting param so reloads within the same session reuse the same asset.
 */
function makeUrl(path: string): string {
  const hasWindow =
    typeof window !== "undefined" &&
    typeof window.location === "object" &&
    typeof window.location.href === "string";

  // Use a string base URL for the URL constructor
  const baseHref =
    hasWindow && typeof window.location.href === "string"
      ? window.location.href
      : "http://localhost/";
  const host =
    hasWindow && typeof window.location.hostname === "string"
      ? window.location.hostname
      : "localhost";

  const url = new URL(path, baseHref);
  const isLocalhost =
    host === "localhost" || host === "127.0.0.1" || host === "::1";
  if (isLocalhost) {
    try {
      const key = "radio.devBuildTs";
      const hasSessionStorage =
        hasWindow &&
        typeof window.sessionStorage === "object" &&
        typeof window.sessionStorage.getItem === "function";
      let buildTs: string;
      if (hasSessionStorage) {
        const existing = window.sessionStorage.getItem(key);
        buildTs = existing ?? String(Date.now());
        if (!existing) {
          window.sessionStorage.setItem(key, buildTs);
        }
      } else {
        // Fallback to per-load cache bust if sessionStorage unavailable
        buildTs = String(Date.now());
      }
      url.searchParams.set("v", buildTs);
    } catch {
      // Fallback to per-load cache bust if sessionStorage throws
      url.searchParams.set("v", String(Date.now()));
    }
  }

  return url.toString();
}

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
 * Check if WebAssembly SIMD is supported
 * Tests with a minimal WASM module containing SIMD instructions
 */
export function isWasmSIMDSupported(): boolean {
  if (!isWasmSupported()) {
    return false;
  }

  try {
    // Minimal WASM module with v128.const and i8x16.popcnt (SIMD instructions)
    return WebAssembly.validate(
      new Uint8Array([
        0,
        97,
        115,
        109,
        1,
        0,
        0,
        0, // WASM header
        1,
        5,
        1,
        96,
        0,
        1,
        127, // Type section
        3,
        2,
        1,
        0, // Function section
        10,
        10,
        1,
        8,
        0, // Code section start
        65,
        0, // i32.const 0
        253,
        12, // v128.const (SIMD instruction)
        253,
        98, // i8x16.popcnt
        11, // end
      ]),
    );
  } catch {
    return false;
  }
}

/**
 * Determine which WASM module variant to load
 * Returns 'simd' if SIMD is supported, otherwise 'standard'
 */
export function getWasmVariant(): "simd" | "standard" {
  return isWasmSIMDSupported() ? "simd" : "standard";
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

  // Determine which variant to load (SIMD or standard)
  const variant = getWasmVariant();
  const useSIMD = variant === "simd";

  // Try SIMD variant first if supported, then fall back to standard
  const candidateUrls = useSIMD
    ? [
        makeUrl("release-simd.js"),
        makeUrl("/release-simd.js"),
        makeUrl("dsp-simd.js"),
        makeUrl("/dsp-simd.js"),
        // Fallback to standard if SIMD not found
        makeUrl("release.js"),
        makeUrl("/release.js"),
        makeUrl("dsp.js"),
        makeUrl("/dsp.js"),
      ]
    : [
        makeUrl("release.js"),
        makeUrl("/release.js"),
        makeUrl("dsp.js"),
        makeUrl("/dsp.js"),
      ];

  const loadPromise = (async (): Promise<WasmDSPModule | null> => {
    let lastError: unknown;
    let loadedWithSIMD = false;

    for (const url of candidateUrls) {
      try {
        const mod = (await dynamicImportModule(url)) as Partial<WasmDSPModule>;
        if (!isValidModule(mod)) {
          throw new Error("Invalid WASM module exports");
        }

        // Check if this is a SIMD module
        loadedWithSIMD = url.includes("simd");

        wasmModule = {
          calculateFFT: mod.calculateFFT.bind(mod),
          calculateWaveform: mod.calculateWaveform.bind(mod),
          calculateSpectrogram: mod.calculateSpectrogram.bind(mod),
          allocateFloat32Array: mod.allocateFloat32Array.bind(mod),
          applyHannWindow: mod.applyHannWindow.bind(mod),
          applyHammingWindow: mod.applyHammingWindow.bind(mod),
          applyBlackmanWindow: mod.applyBlackmanWindow.bind(mod),
        };
        // Bind optional return-by-value APIs if present so callers can detect/use them
        const b1 = buildOptionalBinding(mod, "calculateFFTOut");
        if (b1) {
          Object.assign(wasmModule, b1);
        }
        const b2 = buildOptionalBinding(mod, "calculateWaveformOut");
        if (b2) {
          Object.assign(wasmModule, b2);
        }
        const b3 = buildOptionalBinding(mod, "calculateSpectrogramOut");
        if (b3) {
          Object.assign(wasmModule, b3);
        }

        wasmSupported = true;
        // One-time visibility into loaded exports
        try {
          dspLogger.info(
            `WASM module loaded${loadedWithSIMD ? " (SIMD-optimized)" : ""}`,
            {
              url,
              variant: loadedWithSIMD ? "simd" : "standard",
              simdSupported: isWasmSIMDSupported(),
              exports: getWasmModuleExportStatus(mod),
            },
          );
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
 * Helper to bind an optional method from the dynamically imported module to the
 * strongly-typed wasmModule wrapper. Reduces duplication when wiring optional
 * return-by-value APIs such as calculateFFTOut/calculateWaveformOut/…
 */
function buildOptionalBinding(
  mod: Partial<WasmDSPModule>,
  key: keyof WasmDSPModule,
): Partial<WasmDSPModule> | null {
  const fn = mod[key];
  if (typeof fn === "function") {
    const bound = (fn as (...args: unknown[]) => unknown).bind(mod);
    return { [key]: bound } as Partial<WasmDSPModule>;
  }
  return null;
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
 * In non-browser environments (such as tests or SSR), this function
 * detects the environment by checking hasLocalStorage(). If hasLocalStorage()
 * returns false, WASM is enabled by default.
 */
export function isWasmRuntimeEnabled(): boolean {
  try {
    // Attempt to read from localStorage when available; default to enabled otherwise
    let v: string | null = null;
    if (typeof window !== "undefined" && "localStorage" in window) {
      try {
        v = window.localStorage.getItem("radio.wasm.enabled");
      } catch {
        v = null;
      }
    }
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
    const isProd =
      typeof process !== "undefined" &&
      process.env["NODE_ENV"] === "production";
    // Attempt to read from localStorage if available; otherwise fall back to default
    let v: string | null = null;
    if (typeof window !== "undefined" && "localStorage" in window) {
      try {
        v = window.localStorage.getItem("radio.wasm.validate");
      } catch {
        v = null; // storage unavailable or disabled
      }
    }
    if (v === null) {
      // Default to true in dev, false in prod
      return !isProd;
    }
    return v !== "false";
  } catch {
    return true;
  }
}

// (Previously included hasLocalStorage utility removed in favor of inline guarded access
// to localStorage to improve static analysis and avoid false-positive diagnostics.)

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
      if (!loggedFFTChoice) {
        dspLogger.info("Using calculateFFTOut (return-by-value)");
        loggedFFTChoice = true;
      }
      return wasmModule.calculateFFTOut(iSamples, qSamples, fftSize);
    }

    // Fallback to output-parameter API; note that some loader versions
    // do not copy results back to JS when passing an output array.
    // We'll still use it and rely on higher-level sanity checks/fallbacks.
    if (!loggedFFTChoice) {
      dspLogger.info("Using calculateFFT with output parameter");
      loggedFFTChoice = true;
    }
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
      if (!loggedWaveformChoice) {
        dspLogger.info("Using calculateWaveformOut (return-by-value)");
        loggedWaveformChoice = true;
      }
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
      if (!loggedSpectrogramChoice) {
        dspLogger.info("Using calculateSpectrogramOut (return-by-value)");
        loggedSpectrogramChoice = true;
      }
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
    if (!loggedSpectrogramChoice) {
      dspLogger.info("Using calculateSpectrogram with output parameter");
      loggedSpectrogramChoice = true;
    }
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
 * Helper function to separate I/Q samples into Float32Arrays
 */
function separateIQComponents(samples: Sample[]): {
  iSamples: Float32Array;
  qSamples: Float32Array;
} {
  const iSamples = new Float32Array(samples.length);
  const qSamples = new Float32Array(samples.length);

  for (let i = 0; i < samples.length; i++) {
    iSamples[i] = samples[i]?.I ?? 0;
    qSamples[i] = samples[i]?.Q ?? 0;
  }

  return { iSamples, qSamples };
}

/**
 * Helper function to copy processed I/Q arrays back to samples
 */
function copyIQToSamples(
  samples: Sample[],
  iSamples: Float32Array,
  qSamples: Float32Array,
): void {
  for (let i = 0; i < samples.length; i++) {
    const iVal = iSamples[i];
    const qVal = qSamples[i];
    if (iVal !== undefined && qVal !== undefined) {
      // eslint-disable-next-line no-param-reassign
      samples[i] = { I: iVal, Q: qVal };
    }
  }
}

/**
 * Generic helper for applying WASM window functions
 */
function applyWasmWindow(
  samples: Sample[],
  windowFn: (
    iSamples: Float32Array,
    qSamples: Float32Array,
    size: number,
  ) => void,
  windowName: string,
): boolean {
  if (!wasmModule || samples.length === 0) {
    return false;
  }

  try {
    const { iSamples, qSamples } = separateIQComponents(samples);
    windowFn(iSamples, qSamples, samples.length);
    copyIQToSamples(samples, iSamples, qSamples);
    return true;
  } catch (error) {
    console.warn(`dspWasm: ${windowName} window failed`, error);
    return false;
  }
}

/**
 * Apply Hann window using WASM if available
 * Modifies samples in-place for efficiency
 */
export function applyHannWindowWasm(samples: Sample[]): boolean {
  if (!wasmModule) {
    return false;
  }
  const module = wasmModule;
  return applyWasmWindow(
    samples,
    (i, q, s) => module.applyHannWindow(i, q, s),
    "Hann",
  );
}

/**
 * Apply Hamming window using WASM if available
 */
export function applyHammingWindowWasm(samples: Sample[]): boolean {
  if (!wasmModule) {
    return false;
  }
  const module = wasmModule;
  return applyWasmWindow(
    samples,
    (i, q, s) => module.applyHammingWindow(i, q, s),
    "Hamming",
  );
}

/**
 * Apply Blackman window using WASM if available
 */
export function applyBlackmanWindowWasm(samples: Sample[]): boolean {
  if (!wasmModule) {
    return false;
  }
  const module = wasmModule;
  return applyWasmWindow(
    samples,
    (i, q, s) => module.applyBlackmanWindow(i, q, s),
    "Blackman",
  );
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
