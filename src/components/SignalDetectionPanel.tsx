/**
 * Signal Detection Panel Component
 * Displays detected signals with classification information
 */

import React from "react";
import type { ClassifiedSignal } from "../lib/detection";
import "./SignalDetectionPanel.css";

export interface SignalDetectionPanelProps {
  /** Detected signals */
  signals: ClassifiedSignal[];
  /** Current noise floor in dB */
  noiseFloor: number;
  /** Callback when user clicks on a signal to tune */
  onTuneToSignal?: (frequency: number) => void;
  /** Callback to clear detected signals */
  onClearSignals?: () => void;
}

/**
 * Display signal type with color coding
 */
function SignalTypeBadge({ type }: { type: string }) {
  const colorMap: Record<string, string> = {
    "narrowband-fm": "badge-nfm",
    "wideband-fm": "badge-wfm",
    am: "badge-am",
    digital: "badge-digital",
    pulsed: "badge-pulsed",
    unknown: "badge-unknown",
  };

  return (
    <span className={`signal-badge ${colorMap[type] || "badge-unknown"}`}>
      {type.toUpperCase().replace("-", " ")}
    </span>
  );
}

/**
 * Format frequency in MHz or kHz
 */
function formatFrequency(freq: number): string {
  if (freq >= 1_000_000) {
    return `${(freq / 1_000_000).toFixed(3)} MHz`;
  }
  return `${(freq / 1_000).toFixed(1)} kHz`;
}

/**
 * Format bandwidth in kHz
 */
function formatBandwidth(bw: number): string {
  return `${(bw / 1_000).toFixed(1)} kHz`;
}

/**
 * Signal Detection Panel Component
 */
export function SignalDetectionPanel({
  signals,
  noiseFloor,
  onTuneToSignal,
  onClearSignals,
}: SignalDetectionPanelProps) {
  // Sort signals by SNR (strongest first)
  const sortedSignals = [...signals].sort((a, b) => b.snr - a.snr);

  return (
    <div className="signal-detection-panel">
      <div className="panel-header">
        <h3>Detected Signals</h3>
        <div className="panel-stats">
          <span className="noise-floor">
            Noise Floor: {noiseFloor.toFixed(1)} dB
          </span>
          <span className="signal-count">{signals.length} signals</span>
          {onClearSignals && (
            <button
              className="clear-button"
              onClick={onClearSignals}
              disabled={signals.length === 0}
            >
              Clear
            </button>
          )}
        </div>
      </div>

      <div className="signals-list">
        {sortedSignals.length === 0 ? (
          <div className="no-signals">
            <p>No signals detected yet</p>
            <p className="hint">
              Start scanning or monitoring to detect signals automatically
            </p>
          </div>
        ) : (
          sortedSignals.map((signal) => (
            <div
              key={`signal-${signal.frequency}-${signal.bandwidth}-${signal.power.toFixed(1)}`}
              className="signal-item"
              onClick={() => onTuneToSignal?.(signal.frequency)}
              role={onTuneToSignal ? "button" : undefined}
              tabIndex={onTuneToSignal ? 0 : undefined}
            >
              <div className="signal-header">
                <span className="signal-frequency">
                  {formatFrequency(signal.frequency)}
                </span>
                <SignalTypeBadge type={signal.type} />
              </div>

              <div className="signal-details">
                <div className="detail-row">
                  <span className="label">Power:</span>
                  <span className="value">{signal.power.toFixed(1)} dB</span>
                </div>
                <div className="detail-row">
                  <span className="label">SNR:</span>
                  <span className="value">{signal.snr.toFixed(1)} dB</span>
                </div>
                <div className="detail-row">
                  <span className="label">Bandwidth:</span>
                  <span className="value">
                    {formatBandwidth(signal.bandwidth)}
                  </span>
                </div>
                <div className="detail-row">
                  <span className="label">Confidence:</span>
                  <span className="value">
                    {(signal.confidence * 100).toFixed(0)}%
                  </span>
                </div>
              </div>

              {onTuneToSignal && (
                <div className="signal-action">
                  <span className="tune-hint">Click to tune →</span>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
