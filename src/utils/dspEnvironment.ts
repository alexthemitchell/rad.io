/**
 * DSP Environment Detection and Capability Management
 *
 * Detects runtime capabilities for DSP processing and determines
 * the optimal execution mode based on browser features and deployment environment.
 *
 * Related: ADR-0027 (DSP Pipeline Architecture)
 * Related: ARCHITECTURE.md "DSP Processing Architecture"
 */

import { isWasmSIMDSupported } from "./dspWasm";
import { getSharedBufferCapabilities } from "./sharedRingBuffer";

/**
 * DSP execution modes in order of performance preference
 */
export enum DSPMode {
  /**
   * Zero-copy SharedArrayBuffer with Web Workers
   * Requires: COOP/COEP headers, HTTPS
   * Performance: 10+ GB/s throughput, <0.1ms latency
   */
  SHARED_ARRAY_BUFFER = "shared-array-buffer",

  /**
   * MessageChannel with transferable ArrayBuffers
   * Requires: Web Workers support
   * Performance: 200 MB/s throughput, 1-5ms latency
   */
  MESSAGE_CHANNEL = "message-channel",

  /**
   * Pure JavaScript on main thread (fallback)
   * Requires: Nothing (always available)
   * Performance: Blocks UI, not suitable for real-time
   */
  PURE_JS = "pure-js",
}

/**
 * DSP environment capabilities
 *
 * This interface extends and complements the OptimizationStatus interface in dsp.ts:
 * - OptimizationStatus: Low-level DSP optimization features (WASM, SAB, WebGPU)
 * - DSPCapabilities: High-level deployment detection, mode selection, and user messaging
 *
 * The two systems work together:
 * - DSPCapabilities uses capability detection to select execution mode
 * - OptimizationStatus tracks which optimizations are active within that mode
 */
export interface DSPCapabilities {
  /** Selected execution mode */
  mode: DSPMode;

  /** Whether SharedArrayBuffer is supported */
  sharedArrayBufferSupported: boolean;

  /** Whether cross-origin isolation is enabled */
  crossOriginIsolated: boolean;

  /** Whether Web Workers are supported */
  webWorkersSupported: boolean;

  /** Whether WASM is available */
  wasmAvailable: boolean;

  /** Whether WASM SIMD is supported */
  wasmSIMDSupported: boolean;

  /** Whether WebGPU is available */
  webGPUAvailable: boolean;

  /** Deployment environment type */
  deploymentEnvironment:
    | "development"
    | "github-pages"
    | "custom-headers"
    | "unknown";

  /** Human-readable warnings/limitations */
  warnings: string[];

  /** Performance impact description */
  performanceImpact: string;
}

/**
 * Detect if we're in development mode
 */
function isDevelopment(): boolean {
  return (
    typeof process !== "undefined" &&
    typeof process.env !== "undefined" &&
    process.env["NODE_ENV"] === "development"
  );
}

/**
 * Detect deployment environment
 */
function detectDeploymentEnvironment(): DSPCapabilities["deploymentEnvironment"] {
  if (isDevelopment()) {
    return "development";
  }

  // Check for GitHub Pages
  if (
    typeof window !== "undefined" &&
    window.location.hostname.endsWith(".github.io")
  ) {
    return "github-pages";
  }

  // Check if COOP/COEP headers are present (custom hosting)
  const isolated =
    typeof crossOriginIsolated !== "undefined" && crossOriginIsolated;
  if (isolated) {
    return "custom-headers";
  }

  return "unknown";
}

/**
 * Check if Web Workers are supported
 */
function checkWebWorkersSupport(): boolean {
  return typeof Worker !== "undefined";
}

/**
 * Check if WASM is available
 */
function checkWasmAvailable(): boolean {
  return typeof WebAssembly !== "undefined";
}

/**
 * Check if WASM SIMD is supported
 * Uses the proper SIMD validation from dspWasm.ts
 */
function checkWasmSIMDSupported(): boolean {
  return isWasmSIMDSupported();
}

/**
 * Check if WebGPU is available
 */
function checkWebGPUAvailable(): boolean {
  return typeof navigator !== "undefined" && "gpu" in navigator;
}

/**
 * Determine the best DSP mode based on available capabilities
 */
function determineDSPMode(capabilities: {
  sharedArrayBufferSupported: boolean;
  crossOriginIsolated: boolean;
  webWorkersSupported: boolean;
}): DSPMode {
  // Prefer SharedArrayBuffer if available
  if (
    capabilities.sharedArrayBufferSupported &&
    capabilities.crossOriginIsolated &&
    capabilities.webWorkersSupported
  ) {
    return DSPMode.SHARED_ARRAY_BUFFER;
  }

  // Fall back to MessageChannel if workers are available
  if (capabilities.webWorkersSupported) {
    return DSPMode.MESSAGE_CHANNEL;
  }

  // Last resort: pure JavaScript
  return DSPMode.PURE_JS;
}

/**
 * Generate warnings based on capabilities
 */
function generateWarnings(
  mode: DSPMode,
  deploymentEnv: DSPCapabilities["deploymentEnvironment"],
  sharedBufferCaps: ReturnType<typeof getSharedBufferCapabilities>,
): string[] {
  const warnings: string[] = [];

  if (mode === DSPMode.MESSAGE_CHANNEL) {
    // Check if browser supports SharedArrayBuffer at all
    if (!sharedBufferCaps.supported) {
      warnings.push(
        "SharedArrayBuffer not supported by this browser. Using MessageChannel fallback (slower performance).",
      );
    } else if (!sharedBufferCaps.isolated) {
      // Browser supports SAB but headers are missing
      warnings.push(
        "SharedArrayBuffer not available. Using MessageChannel fallback (slower performance).",
      );
      warnings.push(
        "Cross-origin isolation not enabled. Server must send COOP and COEP headers for optimal performance.",
      );

      if (deploymentEnv === "github-pages") {
        warnings.push(
          "GitHub Pages does not support custom HTTP headers. Consider deploying to Vercel, Netlify, or Cloudflare Pages for full performance.",
        );
      }
    }
  }

  if (mode === DSPMode.PURE_JS) {
    warnings.push(
      "Web Workers not supported. DSP will run on main thread (UI may freeze).",
    );
    warnings.push(
      "This browser does not support modern web features required for optimal performance.",
    );
  }

  return warnings;
}

/**
 * Get performance impact description for each mode
 */
function getPerformanceImpact(mode: DSPMode): string {
  switch (mode) {
    case DSPMode.SHARED_ARRAY_BUFFER:
      return "Optimal performance: Zero-copy transfers, 10+ GB/s throughput, <0.1ms latency";

    case DSPMode.MESSAGE_CHANNEL:
      return "Reduced performance: ~200 MB/s throughput, 1-5ms latency. UI responsive but slower than optimal.";

    case DSPMode.PURE_JS:
      return "Severely degraded: Main thread processing, UI freezes likely. Not recommended for real-time use.";

    default:
      return "Unknown performance characteristics";
  }
}

/**
 * Detect DSP environment capabilities and determine optimal execution mode
 *
 * This function should be called once at application startup to determine
 * the capabilities of the runtime environment.
 *
 * @returns DSP capabilities object with mode selection and warnings
 */
export function detectDSPCapabilities(): DSPCapabilities {
  const sharedBufferCaps = getSharedBufferCapabilities();
  const webWorkersSupported = checkWebWorkersSupport();
  const deploymentEnvironment = detectDeploymentEnvironment();

  const mode = determineDSPMode({
    sharedArrayBufferSupported: sharedBufferCaps.supported,
    crossOriginIsolated: sharedBufferCaps.isolated,
    webWorkersSupported,
  });

  const warnings = generateWarnings(
    mode,
    deploymentEnvironment,
    sharedBufferCaps,
  );
  const performanceImpact = getPerformanceImpact(mode);

  return {
    mode,
    sharedArrayBufferSupported: sharedBufferCaps.supported,
    crossOriginIsolated: sharedBufferCaps.isolated,
    webWorkersSupported,
    wasmAvailable: checkWasmAvailable(),
    wasmSIMDSupported: checkWasmSIMDSupported(),
    webGPUAvailable: checkWebGPUAvailable(),
    deploymentEnvironment,
    warnings,
    performanceImpact,
  };
}

/**
 * Log DSP capabilities to console
 *
 * Should be called once at startup to inform developers and users
 * about the current DSP execution mode and any limitations.
 *
 * Note: DSP capabilities are now displayed in the diagnostics overlay.
 * This function is kept for backward compatibility but logs are removed.
 */
export function logDSPCapabilities(capabilities: DSPCapabilities): void {
  // Capabilities are now displayed in diagnostics overlay
  void capabilities;
}

/**
 * Get a user-friendly message about the current DSP mode
 */
export function getDSPModeUserMessage(mode: DSPMode): {
  title: string;
  message: string;
  severity: "success" | "warning" | "error";
} {
  switch (mode) {
    case DSPMode.SHARED_ARRAY_BUFFER:
      return {
        title: "Optimal Performance Mode",
        message:
          "Your browser supports zero-copy SharedArrayBuffer transfers for maximum DSP performance.",
        severity: "success",
      };

    case DSPMode.MESSAGE_CHANNEL:
      return {
        title: "Fallback Performance Mode",
        message:
          "Running with MessageChannel fallback. Performance is reduced but the application remains functional. For optimal performance, deploy to a platform that supports custom HTTP headers (Vercel, Netlify, Cloudflare Pages).",
        severity: "warning",
      };

    case DSPMode.PURE_JS:
      return {
        title: "Limited Compatibility Mode",
        message:
          "Your browser has limited support for modern web features. DSP processing will run on the main thread, which may cause UI freezes. Please use a modern browser for the best experience.",
        severity: "error",
      };

    default:
      return {
        title: "Unknown Mode",
        message: "DSP mode could not be determined.",
        severity: "error",
      };
  }
}
