/**
 * Signal Quality Meters Component
 *
 * Displays signal quality metrics including SNR, BER, MER, signal strength, and sync lock status.
 */

import React from "react";
import type { SignalQuality } from "../../hooks/useATSCPlayer";

interface SignalQualityMetersProps {
  quality: SignalQuality | null;
}

export function SignalQualityMeters({
  quality,
}: SignalQualityMetersProps): React.JSX.Element {
  if (!quality) {
    return (
      <div className="signal-quality">
        <h3>Signal Quality</h3>
        <p className="empty-state">No signal quality data</p>
      </div>
    );
  }

  return (
    <div className="signal-quality">
      <h3>Signal Quality</h3>
      <div className="quality-metrics">
        <div className="metric">
          <span className="metric-label">Signal Strength</span>
          <div className="metric-bar-container">
            <div
              className="metric-bar"
              style={{
                width: `${quality.signalStrength}%`,
                backgroundColor:
                  quality.signalStrength > 70
                    ? "#10b981"
                    : quality.signalStrength > 40
                      ? "#f59e0b"
                      : "#ef4444",
              }}
            />
          </div>
          <span className="metric-value">{quality.signalStrength}%</span>
        </div>

        <div className="metric">
          <span className="metric-label">SNR</span>
          <span className="metric-value">{quality.snr.toFixed(1)} dB</span>
        </div>

        <div className="metric">
          <span className="metric-label">MER</span>
          <span className="metric-value">{quality.mer.toFixed(1)} dB</span>
        </div>

        <div className="metric">
          <span className="metric-label">BER</span>
          <span className="metric-value">{quality.ber.toExponential(2)}</span>
        </div>

        <div className="metric">
          <span className="metric-label">Sync Lock</span>
          <span
            className={`metric-status ${quality.syncLocked ? "locked" : "unlocked"}`}
          >
            {quality.syncLocked ? "Locked" : "Unlocked"}
          </span>
        </div>
      </div>
    </div>
  );
}
