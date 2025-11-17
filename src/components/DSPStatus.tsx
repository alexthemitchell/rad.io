/**
 * DSP Status Component
 *
 * Displays the current DSP execution mode and environment capabilities.
 * Shows warnings when running in fallback mode and provides guidance
 * for optimal deployment.
 *
 * Related: ADR-0027 (DSP Pipeline Architecture)
 */

import React from "react";
import { useDiagnostics } from "../store";
import { DSPMode, getDSPModeUserMessage } from "../utils/dspEnvironment";
import "../styles/dsp-status.css";

interface DSPStatusProps {
  /** Whether to show detailed information */
  detailed?: boolean;
  /** Optional CSS class name */
  className?: string;
}

/**
 * Get icon for DSP mode
 */
function getDSPModeIcon(mode: DSPMode): string {
  switch (mode) {
    case DSPMode.SHARED_ARRAY_BUFFER:
      return "🚀";
    case DSPMode.MESSAGE_CHANNEL:
      return "⚡";
    case DSPMode.PURE_JS:
      return "🐢";
    default:
      return "❓";
  }
}

/**
 * Get CSS class for severity
 */
function getSeverityClass(severity: "success" | "warning" | "error"): string {
  return `dsp-status-${severity}`;
}

/**
 * Format deployment environment name
 */
function formatDeploymentEnvironment(env: string): string {
  switch (env) {
    case "development":
      return "Development";
    case "github-pages":
      return "GitHub Pages";
    case "custom-headers":
      return "Custom Hosting";
    default:
      return "Unknown";
  }
}

/**
 * DSP Status Component
 */
export function DSPStatus({
  detailed = false,
  className = "",
}: DSPStatusProps): React.JSX.Element | null {
  const { dspCapabilities } = useDiagnostics();

  if (!dspCapabilities) {
    return null;
  }

  const modeMessage = getDSPModeUserMessage(dspCapabilities.mode);
  const modeIcon = getDSPModeIcon(dspCapabilities.mode);
  const severityClass = getSeverityClass(modeMessage.severity);

  return (
    <div className={`dsp-status ${severityClass} ${className}`}>
      <div className="dsp-status-header">
        <span className="dsp-status-icon">{modeIcon}</span>
        <h3 className="dsp-status-title">{modeMessage.title}</h3>
      </div>

      <div className="dsp-status-content">
        <p className="dsp-status-message">{modeMessage.message}</p>

        {detailed && (
          <>
            <div className="dsp-status-details">
              <div className="dsp-status-row">
                <span className="dsp-status-label">Mode:</span>
                <span className="dsp-status-value">{dspCapabilities.mode}</span>
              </div>
              <div className="dsp-status-row">
                <span className="dsp-status-label">Environment:</span>
                <span className="dsp-status-value">
                  {formatDeploymentEnvironment(
                    dspCapabilities.deploymentEnvironment,
                  )}
                </span>
              </div>
              <div className="dsp-status-row">
                <span className="dsp-status-label">Performance:</span>
                <span className="dsp-status-value">
                  {dspCapabilities.performanceImpact}
                </span>
              </div>
            </div>

            {dspCapabilities.warnings.length > 0 && (
              <div className="dsp-status-warnings">
                <h4>⚠️ Warnings:</h4>
                <ul>
                  {dspCapabilities.warnings.map((warning, index) => (
                    <li key={index}>{warning}</li>
                  ))}
                </ul>
              </div>
            )}

            <div className="dsp-status-features">
              <h4>Browser Features:</h4>
              <div className="dsp-status-feature-grid">
                <div className="dsp-status-feature">
                  <span className="dsp-status-feature-label">
                    SharedArrayBuffer:
                  </span>
                  <span
                    className={`dsp-status-feature-value ${
                      dspCapabilities.sharedArrayBufferSupported
                        ? "feature-enabled"
                        : "feature-disabled"
                    }`}
                  >
                    {dspCapabilities.sharedArrayBufferSupported ? "✓" : "✗"}
                  </span>
                </div>
                <div className="dsp-status-feature">
                  <span className="dsp-status-feature-label">
                    Cross-Origin Isolated:
                  </span>
                  <span
                    className={`dsp-status-feature-value ${
                      dspCapabilities.crossOriginIsolated
                        ? "feature-enabled"
                        : "feature-disabled"
                    }`}
                  >
                    {dspCapabilities.crossOriginIsolated ? "✓" : "✗"}
                  </span>
                </div>
                <div className="dsp-status-feature">
                  <span className="dsp-status-feature-label">Web Workers:</span>
                  <span
                    className={`dsp-status-feature-value ${
                      dspCapabilities.webWorkersSupported
                        ? "feature-enabled"
                        : "feature-disabled"
                    }`}
                  >
                    {dspCapabilities.webWorkersSupported ? "✓" : "✗"}
                  </span>
                </div>
                <div className="dsp-status-feature">
                  <span className="dsp-status-feature-label">WASM:</span>
                  <span
                    className={`dsp-status-feature-value ${
                      dspCapabilities.wasmAvailable
                        ? "feature-enabled"
                        : "feature-disabled"
                    }`}
                  >
                    {dspCapabilities.wasmAvailable ? "✓" : "✗"}
                  </span>
                </div>
                <div className="dsp-status-feature">
                  <span className="dsp-status-feature-label">WASM SIMD:</span>
                  <span
                    className={`dsp-status-feature-value ${
                      dspCapabilities.wasmSIMDSupported
                        ? "feature-enabled"
                        : "feature-disabled"
                    }`}
                  >
                    {dspCapabilities.wasmSIMDSupported ? "✓" : "✗"}
                  </span>
                </div>
                <div className="dsp-status-feature">
                  <span className="dsp-status-feature-label">WebGPU:</span>
                  <span
                    className={`dsp-status-feature-value ${
                      dspCapabilities.webGPUAvailable
                        ? "feature-enabled"
                        : "feature-disabled"
                    }`}
                  >
                    {dspCapabilities.webGPUAvailable ? "✓" : "✗"}
                  </span>
                </div>
              </div>
            </div>

            {dspCapabilities.mode === DSPMode.MESSAGE_CHANNEL &&
              dspCapabilities.deploymentEnvironment === "github-pages" && (
                <div className="dsp-status-recommendation">
                  <h4>💡 Recommendation:</h4>
                  <p>
                    For optimal performance, consider deploying to a platform
                    that supports custom HTTP headers:
                  </p>
                  <ul>
                    <li>
                      <a
                        href="https://vercel.com"
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        Vercel
                      </a>{" "}
                      (free tier available)
                    </li>
                    <li>
                      <a
                        href="https://netlify.com"
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        Netlify
                      </a>{" "}
                      (free tier available)
                    </li>
                    <li>
                      <a
                        href="https://pages.cloudflare.com"
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        Cloudflare Pages
                      </a>{" "}
                      (free tier available)
                    </li>
                  </ul>
                  <p>
                    These platforms support the COOP and COEP headers required
                    for SharedArrayBuffer, enabling zero-copy DSP transfers and
                    maximum performance.
                  </p>
                </div>
              )}
          </>
        )}
      </div>
    </div>
  );
}
