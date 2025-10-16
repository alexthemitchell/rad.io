import { useState, ChangeEvent } from "react";
import {
  ScanConfig,
  ActiveSignal,
  FrequencyScannerState,
} from "../hooks/useFrequencyScanner";

type FrequencyScannerProps = {
  state: FrequencyScannerState;
  onStartScan: (config: ScanConfig) => void;
  onPauseScan: () => void;
  onResumeScan: () => void;
  onStopScan: () => void;
  onClearSignals: () => void;
  disabled?: boolean;
  signalType: "FM" | "AM" | "P25";
};

export default function FrequencyScanner({
  state,
  onStartScan,
  onPauseScan,
  onResumeScan,
  onStopScan,
  onClearSignals,
  disabled = false,
  signalType,
}: FrequencyScannerProps): React.JSX.Element {
  // Default configurations based on signal type
  const getDefaultConfig = (): ScanConfig => {
    if (signalType === "FM") {
      return {
        startFrequency: 88.1e6,
        endFrequency: 107.9e6,
        stepSize: 0.2e6, // 200 kHz
        dwellTime: 100,
        signalThreshold: -60,
      };
    } else if (signalType === "AM") {
      return {
        startFrequency: 530e3,
        endFrequency: 1700e3,
        stepSize: 10e3, // 10 kHz
        dwellTime: 100,
        signalThreshold: -70,
      };
    } else {
      // P25
      return {
        startFrequency: 764e6,
        endFrequency: 776e6,
        stepSize: 12.5e3, // 12.5 kHz
        dwellTime: 150,
        signalThreshold: -65,
      };
    }
  };

  const [config, setConfig] = useState<ScanConfig>(getDefaultConfig());

  const handleStartScan = (): void => {
    onStartScan(config);
  };

  const handleConfigChange = (
    field: keyof ScanConfig,
    value: number,
  ): void => {
    setConfig((prev) => ({ ...prev, [field]: value }));
  };

  const formatFrequency = (frequencyHz: number): string => {
    if (signalType === "FM" || signalType === "P25") {
      return `${(frequencyHz / 1e6).toFixed(2)} MHz`;
    } else {
      return `${(frequencyHz / 1e3).toFixed(0)} kHz`;
    }
  };

  const getFrequencyUnit = (): string => {
    return signalType === "AM" ? "kHz" : "MHz";
  };

  const getFrequencyDivisor = (): number => {
    return signalType === "AM" ? 1e3 : 1e6;
  };

  const formatTimestamp = (timestamp: number): string => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString();
  };

  return (
    <div className="frequency-scanner">
      <div className="scanner-controls">
        <div className="control-row">
          <div className="control-group">
            <label htmlFor="start-freq" className="control-label">
              Start ({getFrequencyUnit()})
            </label>
            <input
              id="start-freq"
              type="number"
              className="control-input"
              value={(config.startFrequency / getFrequencyDivisor()).toFixed(
                signalType === "AM" ? 0 : 2,
              )}
              onChange={(e: ChangeEvent<HTMLInputElement>) =>
                handleConfigChange(
                  "startFrequency",
                  Number(e.target.value) * getFrequencyDivisor(),
                )
              }
              disabled={state.status === "scanning" || disabled}
              step={signalType === "AM" ? 10 : 0.1}
              aria-label="Scan start frequency"
            />
          </div>

          <div className="control-group">
            <label htmlFor="end-freq" className="control-label">
              End ({getFrequencyUnit()})
            </label>
            <input
              id="end-freq"
              type="number"
              className="control-input"
              value={(config.endFrequency / getFrequencyDivisor()).toFixed(
                signalType === "AM" ? 0 : 2,
              )}
              onChange={(e: ChangeEvent<HTMLInputElement>) =>
                handleConfigChange(
                  "endFrequency",
                  Number(e.target.value) * getFrequencyDivisor(),
                )
              }
              disabled={state.status === "scanning" || disabled}
              step={signalType === "AM" ? 10 : 0.1}
              aria-label="Scan end frequency"
            />
          </div>

          <div className="control-group">
            <label htmlFor="step-size" className="control-label">
              Step ({getFrequencyUnit()})
            </label>
            <input
              id="step-size"
              type="number"
              className="control-input"
              value={(config.stepSize / getFrequencyDivisor()).toFixed(
                signalType === "AM" ? 0 : 3,
              )}
              onChange={(e: ChangeEvent<HTMLInputElement>) =>
                handleConfigChange(
                  "stepSize",
                  Number(e.target.value) * getFrequencyDivisor(),
                )
              }
              disabled={state.status === "scanning" || disabled}
              step={signalType === "AM" ? 10 : 0.1}
              aria-label="Scan step size"
            />
          </div>
        </div>

        <div className="control-row">
          <div className="control-group">
            <label htmlFor="dwell-time" className="control-label">
              Dwell Time (ms)
            </label>
            <input
              id="dwell-time"
              type="number"
              className="control-input"
              value={config.dwellTime}
              onChange={(e: ChangeEvent<HTMLInputElement>) =>
                handleConfigChange("dwellTime", Number(e.target.value))
              }
              disabled={state.status === "scanning" || disabled}
              min={50}
              max={1000}
              step={50}
              aria-label="Dwell time per frequency"
            />
          </div>

          <div className="control-group">
            <label htmlFor="signal-threshold" className="control-label">
              Threshold (dBm)
            </label>
            <input
              id="signal-threshold"
              type="number"
              className="control-input"
              value={config.signalThreshold}
              onChange={(e: ChangeEvent<HTMLInputElement>) =>
                handleConfigChange("signalThreshold", Number(e.target.value))
              }
              disabled={state.status === "scanning" || disabled}
              min={-100}
              max={-20}
              step={5}
              aria-label="Signal detection threshold"
            />
          </div>
        </div>

        <div className="scanner-actions">
          {state.status === "idle" || state.status === "completed" ? (
            <button
              className="btn btn-primary"
              onClick={handleStartScan}
              disabled={disabled}
              aria-label="Start frequency scan"
            >
              Start Scan
            </button>
          ) : null}

          {state.status === "scanning" ? (
            <>
              <button
                className="btn btn-secondary"
                onClick={onPauseScan}
                aria-label="Pause frequency scan"
              >
                Pause Scan
              </button>
              <button
                className="btn btn-danger"
                onClick={onStopScan}
                aria-label="Stop frequency scan"
              >
                Stop
              </button>
            </>
          ) : null}

          {state.status === "paused" ? (
            <>
              <button
                className="btn btn-primary"
                onClick={onResumeScan}
                aria-label="Resume frequency scan"
              >
                Resume Scan
              </button>
              <button
                className="btn btn-danger"
                onClick={onStopScan}
                aria-label="Stop frequency scan"
              >
                Stop
              </button>
            </>
          ) : null}
        </div>
      </div>

      {state.status !== "idle" && (
        <div className="scan-progress">
          <div className="progress-info">
            <span>
              Current: {formatFrequency(state.currentFrequency)} | Progress:{" "}
              {state.progress}%
            </span>
            <span className="scan-status">
              {state.status === "scanning"
                ? "Scanning..."
                : state.status === "paused"
                  ? "Paused"
                  : "Completed"}
            </span>
          </div>
          <div className="progress-bar">
            <div
              className="progress-fill"
              style={{ width: `${state.progress}%` }}
              role="progressbar"
              aria-valuenow={state.progress}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label="Scan progress"
            />
          </div>
        </div>
      )}

      <div className="active-signals">
        <div className="signals-header">
          <h4>Active Signals ({state.activeSignals.length})</h4>
          {state.activeSignals.length > 0 && (
            <button
              className="btn btn-small"
              onClick={onClearSignals}
              aria-label="Clear active signals list"
            >
              Clear
            </button>
          )}
        </div>

        {state.activeSignals.length === 0 ? (
          <p className="no-signals">
            No active signals detected above threshold
          </p>
        ) : (
          <div className="signals-list" role="log" aria-live="polite">
            <table className="signals-table">
              <thead>
                <tr>
                  <th>Frequency</th>
                  <th>Strength</th>
                  <th>Time</th>
                </tr>
              </thead>
              <tbody>
                {state.activeSignals
                  .slice()
                  .reverse()
                  .map((signal: ActiveSignal, index: number) => (
                    <tr key={`${signal.frequency}-${signal.timestamp}-${index}`}>
                      <td>{formatFrequency(signal.frequency)}</td>
                      <td>{signal.signalStrength.toFixed(1)} dBm</td>
                      <td>{formatTimestamp(signal.timestamp)}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
