/**
 * Scan Control Component
 * UI for configuring and controlling frequency scans
 */

import React, { useState } from "react";
import type { ScanConfig, ScanStrategy } from "../lib/scanning/types";
import "./ScanControl.css";

export interface ScanControlProps {
  /** Whether a scan is currently running */
  isScanning: boolean;
  /** Current scan progress (0-100) */
  progress: number;
  /** Callback to start scan */
  onStartScan: (config: ScanConfig) => void;
  /** Callback to stop scan */
  onStopScan: () => void;
  /** Initial scan configuration */
  initialConfig?: Partial<ScanConfig>;
}

/**
 * Scan Control Component
 */
export function ScanControl({
  isScanning,
  progress,
  onStartScan,
  onStopScan,
  initialConfig = {},
}: ScanControlProps) {
  const [startFreq, setStartFreq] = useState(
    initialConfig.startFreq ?? 146_000_000,
  );
  const [endFreq, setEndFreq] = useState(initialConfig.endFreq ?? 148_000_000);
  const [step, setStep] = useState(initialConfig.step ?? 25_000);
  const [strategy, setStrategy] = useState<ScanStrategy>(
    initialConfig.strategy ?? "linear",
  );

  const handleStartScan = () => {
    if (startFreq >= endFreq) {
      alert("Start frequency must be less than end frequency");
      return;
    }

    const config: ScanConfig = {
      startFreq,
      endFreq,
      step,
      strategy,
      settlingTime: 50,
      sampleCount: 2048,
    };

    onStartScan(config);
  };

  const totalFreqs = Math.ceil((endFreq - startFreq) / step);
  const estimatedTime = (totalFreqs * 50) / 1000; // Rough estimate in seconds

  return (
    <div className="scan-control">
      <h3>Frequency Scanner</h3>

      <div className="scan-form">
        <div className="form-row">
          <label>
            Start Frequency (Hz)
            <input
              type="number"
              value={startFreq}
              onChange={(e) => setStartFreq(Number(e.target.value))}
              disabled={isScanning}
              step={1_000_000}
            />
            <span className="freq-display">
              {(startFreq / 1_000_000).toFixed(3)} MHz
            </span>
          </label>
        </div>

        <div className="form-row">
          <label>
            End Frequency (Hz)
            <input
              type="number"
              value={endFreq}
              onChange={(e) => setEndFreq(Number(e.target.value))}
              disabled={isScanning}
              step={1_000_000}
            />
            <span className="freq-display">
              {(endFreq / 1_000_000).toFixed(3)} MHz
            </span>
          </label>
        </div>

        <div className="form-row">
          <label>
            Step Size (Hz)
            <input
              type="number"
              value={step}
              onChange={(e) => setStep(Number(e.target.value))}
              disabled={isScanning}
              step={1_000}
            />
            <span className="freq-display">
              {(step / 1_000).toFixed(1)} kHz
            </span>
          </label>
        </div>

        <div className="form-row">
          <label>
            Scan Strategy
            <select
              value={strategy}
              onChange={(e) => setStrategy(e.target.value as ScanStrategy)}
              disabled={isScanning}
            >
              <option value="linear">Linear (Sequential)</option>
              <option value="adaptive">Adaptive (Learning)</option>
              <option value="priority">Priority (Bookmarks First)</option>
            </select>
          </label>
        </div>

        <div className="scan-info">
          <div className="info-item">
            <span className="label">Frequencies:</span>
            <span className="value">{totalFreqs}</span>
          </div>
          <div className="info-item">
            <span className="label">Est. Time:</span>
            <span className="value">{estimatedTime.toFixed(1)}s</span>
          </div>
        </div>

        {isScanning && (
          <div className="progress-container">
            <div className="progress-bar">
              <div
                className="progress-fill"
                style={{ width: `${progress}%` }}
              />
            </div>
            <div className="progress-text">{progress.toFixed(0)}%</div>
          </div>
        )}

        <div className="button-group">
          {!isScanning ? (
            <button className="start-button" onClick={handleStartScan}>
              Start Scan
            </button>
          ) : (
            <button className="stop-button" onClick={onStopScan}>
              Stop Scan
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
