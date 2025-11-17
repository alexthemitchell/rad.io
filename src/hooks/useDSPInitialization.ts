/**
 * DSP Initialization Hook
 *
 * Detects DSP environment capabilities on application startup
 * and stores them in the diagnostics store.
 *
 * Related: ADR-0027 (DSP Pipeline Architecture)
 */

import { useEffect } from "react";
import { useDiagnostics } from "../store";
import {
  detectDSPCapabilities,
  logDSPCapabilities,
  DSPMode,
} from "../utils/dspEnvironment";

/**
 * Hook to initialize DSP environment detection
 *
 * Call this once at the root of the application to detect
 * and store DSP capabilities.
 *
 * @example
 * ```tsx
 * function App() {
 *   useDSPInitialization();
 *   return <YourApp />;
 * }
 * ```
 */
export function useDSPInitialization(): void {
  const { setDSPCapabilities, addDiagnosticEvent } = useDiagnostics();

  useEffect(() => {
    // Detect capabilities
    const capabilities = detectDSPCapabilities();

    // Store in diagnostics store
    setDSPCapabilities(capabilities);

    // Log to console for developers
    logDSPCapabilities(capabilities);

    // Add diagnostic events for warnings
    if (capabilities.warnings.length > 0) {
      capabilities.warnings.forEach((warning) => {
        addDiagnosticEvent({
          source: "system",
          severity: "warning",
          message: warning,
        });
      });
    }

    // Add success event for optimal mode
    if (capabilities.mode === DSPMode.SHARED_ARRAY_BUFFER) {
      addDiagnosticEvent({
        source: "system",
        severity: "info",
        message: "DSP running in optimal mode with SharedArrayBuffer support",
      });
    }
    // We intentionally use an empty dependency array here:
    // - Zustand action references are stable
    // - This effect should only run once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
