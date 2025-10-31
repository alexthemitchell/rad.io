import type {
  ActiveSignal,
  ScannerState,
  FrequencyScanConfig,
} from "../hooks/useFrequencyScanner";

/**
 * Map of signal types to display names
 */
/* eslint-disable @typescript-eslint/naming-convention */
const SIGNAL_TYPE_MAP: Record<string, string> = {
  "narrowband-fm": "NFM",
  "wideband-fm": "WFM",
  am: "AM",
  digital: "Digital",
  pulsed: "Pulsed",
};
/* eslint-enable @typescript-eslint/naming-convention */

export interface FrequencyScannerProps {
  /** Current scanner state */
  state: ScannerState;
  /** Scanner configuration */
  config: FrequencyScanConfig;
  /** Current frequency being scanned (Hz) */
  currentFrequency: number | null;
  /** List of active signals found */
  activeSignals: ActiveSignal[];
  /** Scan progress (0-100) */
  progress: number;
  /** Callback to start scanning */
  onStartScan: () => void;
  /** Callback to pause scanning */
  onPauseScan: () => void;
  /** Callback to resume scanning */
  onResumeScan: () => void;
  /** Callback to stop scanning */
  onStopScan: () => void;
  /** Callback when config changes */
  onConfigChange: (updates: Partial<FrequencyScanConfig>) => void;
  /** Callback to clear signals list */
  onClearSignals: () => void;
  /** Whether device is available */
  deviceAvailable: boolean;
  /** Optional callback to tune to a found signal */
  onTuneToSignal?: (frequency: number) => void;
}

/**
 * Frequency Scanner Component
 * Provides UI for automated frequency scanning with signal detection
 */
function FrequencyScanner({
  state,
  config,
  currentFrequency,
  activeSignals,
  progress,
  onStartScan,
  onPauseScan,
  onResumeScan,
  onStopScan,
  onConfigChange,
  onClearSignals,
  deviceAvailable,
  onTuneToSignal,
}: FrequencyScannerProps): React.JSX.Element {
  const isScanning = state === "scanning";
  const isPaused = state === "paused";
  const isIdle = state === "idle";

  /**
   * Format frequency for display
   */
  const formatFrequency = (freqHz: number): string => {
    if (freqHz >= 1e6) {
      return `${(freqHz / 1e6).toFixed(3)} MHz`;
    }
    return `${(freqHz / 1e3).toFixed(1)} kHz`;
  };

  /**
   * Format signal type for display
   */
  const formatSignalType = (type?: string, confidence?: number): string => {
    if (!type || type === "unknown") {
      return "Unknown";
    }
    const displayType = SIGNAL_TYPE_MAP[type] ?? type;
    if (confidence !== undefined) {
      return `${displayType} (${(confidence * 100).toFixed(0)}%)`;
    }
    return displayType;
  };

  /**
   * Export signals to JSON
   */
  const handleExport = (): void => {
    const dataStr = JSON.stringify(activeSignals, null, 2);
    const dataBlob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `scan-results-${Date.now()}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="card">
      <h2>Frequency Scanner</h2>

      {/* Configuration Section */}
      <div className="scanner-config">
        <div className="form-group">
          <label htmlFor="start-freq">
            Start Frequency (MHz):
            <input
              id="start-freq"
              type="number"
              value={config.startFrequency / 1e6}
              onChange={(e) =>
                onConfigChange({
                  startFrequency: parseFloat(e.target.value) * 1e6,
                })
              }
              disabled={!isIdle}
              step="0.1"
              min="0.01"
              max="6000"
            />
          </label>
        </div>

        <div className="form-group">
          <label htmlFor="end-freq">
            End Frequency (MHz):
            <input
              id="end-freq"
              type="number"
              value={config.endFrequency / 1e6}
              onChange={(e) =>
                onConfigChange({
                  endFrequency: parseFloat(e.target.value) * 1e6,
                })
              }
              disabled={!isIdle}
              step="0.1"
              min="0.01"
              max="6000"
            />
          </label>
        </div>

        <div className="form-group">
          <label htmlFor="fft-size">
            FFT Size (frequency resolution):
            <input
              id="fft-size"
              type="number"
              value={config.fftSize}
              onChange={(e) =>
                onConfigChange({ fftSize: parseInt(e.target.value, 10) })
              }
              disabled={!isIdle}
              step="512"
              min="512"
              max="8192"
            />
          </label>
        </div>

        <div className="form-group">
          <label htmlFor="threshold">
            Detection Threshold ({config.thresholdDb} dB above noise):
            <input
              id="threshold"
              type="number"
              value={config.thresholdDb}
              onChange={(e) =>
                onConfigChange({ thresholdDb: parseFloat(e.target.value) })
              }
              min="3"
              max="30"
              step="1"
              disabled={!isIdle}
            />
          </label>
        </div>

        <div className="form-group">
          <label htmlFor="dwell-time">
            Dwell Time (ms):
            <input
              id="dwell-time"
              type="number"
              value={config.dwellTime}
              onChange={(e) =>
                onConfigChange({ dwellTime: parseInt(e.target.value, 10) })
              }
              disabled={!isIdle}
              step="10"
              min="10"
              max="1000"
            />
          </label>
        </div>
      </div>

      {/* Control Buttons */}
      <div className="scanner-controls">
        {isIdle && (
          <button
            className="btn btn-primary"
            onClick={onStartScan}
            disabled={!deviceAvailable}
            title={
              deviceAvailable
                ? "Start frequency scanning"
                : "Device not available"
            }
          >
            Start Scan
          </button>
        )}

        {isScanning && (
          <>
            <button className="btn btn-warning" onClick={onPauseScan}>
              Pause
            </button>
            <button className="btn btn-danger" onClick={onStopScan}>
              Stop
            </button>
          </>
        )}

        {isPaused && (
          <>
            <button className="btn btn-primary" onClick={onResumeScan}>
              Resume
            </button>
            <button className="btn btn-danger" onClick={onStopScan}>
              Stop
            </button>
          </>
        )}
      </div>

      {/* Progress Bar */}
      {(isScanning || isPaused) && (
        <div className="scanner-progress">
          <div className="progress-bar-container">
            <div
              className="progress-bar-fill"
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className="progress-text">
            {currentFrequency && (
              <span>
                Scanning: {formatFrequency(currentFrequency)} (
                {progress.toFixed(1)}%)
              </span>
            )}
          </div>
        </div>
      )}

      {/* Active Signals List */}
      <div className="active-signals">
        <div className="signals-header">
          <h3>Active Signals ({activeSignals.length})</h3>
          <div className="signals-actions">
            {activeSignals.length > 0 && (
              <>
                <button
                  className="btn btn-secondary"
                  onClick={handleExport}
                  title="Export signals to JSON file"
                >
                  Export
                </button>
                <button
                  className="btn btn-secondary"
                  onClick={onClearSignals}
                  title="Clear signals list"
                >
                  Clear
                </button>
              </>
            )}
          </div>
        </div>

        {activeSignals.length === 0 ? (
          <p className="empty-state">
            No active signals detected yet. Start a scan to find signals.
          </p>
        ) : (
          <div className="signals-list">
            <table>
              <thead>
                <tr>
                  <th>Frequency</th>
                  <th>Strength</th>
                  <th>Type</th>
                  <th>Station</th>
                  <th>RDS Info</th>
                  <th>Time</th>
                  {onTuneToSignal && <th>Actions</th>}
                </tr>
              </thead>
              <tbody>
                {[...activeSignals]
                  .sort((a, b) => b.strength - a.strength)
                  .map((signal, index) => (
                    <tr key={`${signal.frequency}-${index}`}>
                      <td>{formatFrequency(signal.frequency)}</td>
                      <td>
                        <div className="strength-indicator">
                          <div
                            className="strength-bar"
                            style={{
                              width: `${signal.strength * 100}%`,
                              backgroundColor:
                                signal.strength > 0.7
                                  ? "#10b981"
                                  : signal.strength > 0.4
                                    ? "#f59e0b"
                                    : "#ef4444",
                            }}
                          />
                          <span>{(signal.strength * 100).toFixed(1)}%</span>
                        </div>
                      </td>
                      <td>
                        <div className="signal-type">
                          {formatSignalType(signal.type, signal.confidence)}
                        </div>
                      </td>
                      <td>
                        {signal.rdsData?.ps ? (
                          <div className="rds-station">
                            <strong>{signal.rdsData.ps}</strong>
                          </div>
                        ) : (
                          <span className="no-rds">—</span>
                        )}
                      </td>
                      <td>
                        {signal.rdsData ? (
                          <div className="rds-info">
                            {signal.rdsData.rt && (
                              <div
                                className="rds-text"
                                title={signal.rdsData.rt}
                              >
                                {signal.rdsData.rt.length > 30
                                  ? `${signal.rdsData.rt.substring(0, 30)}...`
                                  : signal.rdsData.rt}
                              </div>
                            )}
                            {signal.rdsStats?.syncLocked && (
                              <span className="rds-badge">RDS</span>
                            )}
                          </div>
                        ) : (
                          <span className="no-rds">No RDS</span>
                        )}
                      </td>
                      <td>{signal.timestamp.toLocaleTimeString()}</td>
                      {onTuneToSignal && (
                        <td>
                          <button
                            className="btn btn-sm btn-primary"
                            onClick={() => onTuneToSignal(signal.frequency)}
                            title="Tune to this frequency in Live Monitor"
                          >
                            Tune
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <style>{`
        .scanner-config {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 1rem;
          margin-bottom: 1.5rem;
        }

        .form-group {
          display: flex;
          flex-direction: column;
        }

        .form-group label {
          display: flex;
          flex-direction: column;
          font-size: 0.875rem;
          font-weight: 500;
          margin-bottom: 0.25rem;
        }

        .form-group input {
          margin-top: 0.25rem;
          padding: 0.5rem;
          border: 1px solid #374151;
          border-radius: 0.375rem;
          background: #1f2937;
          color: #f9fafb;
          font-size: 0.875rem;
        }

        .form-group input:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .scanner-controls {
          display: flex;
          gap: 0.75rem;
          margin-bottom: 1.5rem;
        }

        .scanner-progress {
          margin-bottom: 1.5rem;
        }

        .progress-bar-container {
          width: 100%;
          height: 1.5rem;
          background: #1f2937;
          border-radius: 0.375rem;
          overflow: hidden;
          margin-bottom: 0.5rem;
        }

        .progress-bar-fill {
          height: 100%;
          background: linear-gradient(90deg, #3b82f6, #8b5cf6);
          transition: width 0.3s ease;
        }

        .progress-text {
          font-size: 0.875rem;
          color: #9ca3af;
        }

        .active-signals {
          margin-top: 1.5rem;
        }

        .signals-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 1rem;
        }

        .signals-header h3 {
          margin: 0;
          font-size: 1.125rem;
        }

        .signals-actions {
          display: flex;
          gap: 0.5rem;
        }

        .empty-state {
          padding: 2rem;
          text-align: center;
          color: #9ca3af;
          background: #1f2937;
          border-radius: 0.375rem;
        }

        .signals-list {
          overflow-x: auto;
        }

        .signals-list table {
          width: 100%;
          border-collapse: collapse;
          font-size: 0.875rem;
        }

        .signals-list th {
          text-align: left;
          padding: 0.75rem;
          background: #1f2937;
          font-weight: 600;
          border-bottom: 2px solid #374151;
        }

        .signals-list td {
          padding: 0.75rem;
          border-bottom: 1px solid #374151;
        }

        .signals-list tr:hover {
          background: #1f2937;
        }

        .strength-indicator {
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }

        .strength-bar {
          height: 0.5rem;
          min-width: 2rem;
          border-radius: 0.25rem;
          transition: width 0.3s ease;
        }

        .signal-type {
          font-size: 0.875rem;
          font-weight: 500;
          color: #a78bfa;
          font-family: monospace;
        }

        .rds-station {
          font-family: monospace;
          font-size: 0.875rem;
          color: #60a5fa;
        }

        .rds-info {
          display: flex;
          flex-direction: column;
          gap: 0.25rem;
          font-size: 0.75rem;
        }

        .rds-text {
          color: #9ca3af;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          max-width: 250px;
        }

        .rds-badge {
          display: inline-block;
          padding: 0.125rem 0.375rem;
          background: #10b981;
          color: #000;
          border-radius: 0.25rem;
          font-weight: 600;
          font-size: 0.625rem;
          text-transform: uppercase;
        }

        .no-rds {
          color: #6b7280;
          font-style: italic;
        }

        @media (max-width: 768px) {
          .scanner-config {
            grid-template-columns: 1fr;
          }

          .signals-header {
            flex-direction: column;
            align-items: flex-start;
            gap: 0.5rem;
          }

          .rds-text {
            max-width: 150px;
          }
        }
      `}</style>
    </div>
  );
}

export default FrequencyScanner;
