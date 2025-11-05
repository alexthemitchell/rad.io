/**
 * Signal Tooltip Component
 * Displays detailed information about a detected signal on hover
 */

import React from "react";
import type { DetectedSignal } from "../hooks/useSignalDetection";
import "./SignalTooltip.css";

export interface SignalTooltipProps {
  /** Signal to display information for */
  signal: DetectedSignal | null;
  /** X position in pixels */
  x: number;
  /** Y position in pixels */
  y: number;
  /** Whether tooltip is visible */
  visible: boolean;
}

/**
 * Format frequency with appropriate units
 */
function formatFrequency(hz: number): string {
  if (hz >= 1e9) {
    return `${(hz / 1e9).toFixed(3)} GHz`;
  } else if (hz >= 1e6) {
    return `${(hz / 1e6).toFixed(3)} MHz`;
  } else if (hz >= 1e3) {
    return `${(hz / 1e3).toFixed(3)} kHz`;
  }
  return `${hz.toFixed(0)} Hz`;
}

/**
 * Format bandwidth with appropriate units
 */
function formatBandwidth(hz: number): string {
  if (hz >= 1e6) {
    return `${(hz / 1e6).toFixed(2)} MHz`;
  } else if (hz >= 1e3) {
    return `${(hz / 1e3).toFixed(1)} kHz`;
  }
  return `${hz.toFixed(0)} Hz`;
}

/**
 * Get human-readable modulation type
 */
function getModulationName(type: string): string {
  /* eslint-disable @typescript-eslint/naming-convention */
  const names: Record<string, string> = {
    "wideband-fm": "Wideband FM (Broadcast)",
    "narrowband-fm": "Narrowband FM (2-way Radio)",
    am: "Amplitude Modulation",
    digital: "Digital Signal",
    unknown: "Unknown",
  };
  /* eslint-enable @typescript-eslint/naming-convention */
  return names[type] ?? "Unknown";
}

/**
 * Signal Tooltip Component
 */
export function SignalTooltip({
  signal,
  x,
  y,
  visible,
}: SignalTooltipProps): React.JSX.Element | null {
  if (!visible || !signal) {
    return null;
  }

  // Position tooltip near cursor but avoid going off-screen
  const tooltipStyle: React.CSSProperties = {
    left: `${x + 10}px`,
    top: `${y + 10}px`,
  };

  return (
    <div className="signal-tooltip" style={tooltipStyle} role="tooltip">
      <div className="signal-tooltip-header">
        <span className="signal-tooltip-frequency">
          {formatFrequency(signal.frequency)}
        </span>
        <span
          className={`signal-tooltip-status ${signal.isActive ? "active" : "inactive"}`}
        >
          {signal.isActive ? "Active" : "Inactive"}
        </span>
      </div>

      <div className="signal-tooltip-content">
        <div className="signal-tooltip-row">
          <span className="signal-tooltip-label">Modulation:</span>
          <span className="signal-tooltip-value">
            {getModulationName(signal.type)}
          </span>
        </div>

        <div className="signal-tooltip-row">
          <span className="signal-tooltip-label">Bandwidth:</span>
          <span className="signal-tooltip-value">
            {formatBandwidth(signal.bandwidth)}
          </span>
        </div>

        <div className="signal-tooltip-row">
          <span className="signal-tooltip-label">Power:</span>
          <span className="signal-tooltip-value">
            {signal.power.toFixed(1)} dB
          </span>
        </div>

        <div className="signal-tooltip-row">
          <span className="signal-tooltip-label">SNR:</span>
          <span className="signal-tooltip-value">
            {signal.snr.toFixed(1)} dB
          </span>
        </div>

        <div className="signal-tooltip-row">
          <span className="signal-tooltip-label">Confidence:</span>
          <span className="signal-tooltip-value">
            {(signal.confidence * 100).toFixed(0)}%
          </span>
        </div>

        {signal.label && (
          <div className="signal-tooltip-row">
            <span className="signal-tooltip-label">Label:</span>
            <span className="signal-tooltip-value">{signal.label}</span>
          </div>
        )}
      </div>
    </div>
  );
}
