/**
 * ATSC Channel Scanner Component
 *
 * UI for scanning ATSC digital television channels with pilot detection
 * and signal quality measurement.
 */

import type {
  ATSCScanConfig,
  ATSCScannerState,
} from "../hooks/useATSCScanner";
import type { ATSCChannel } from "../utils/atscChannels";
import type { StoredATSCChannel } from "../utils/atscChannelStorage";
import { formatATSCChannel } from "../utils/atscChannels";

export interface ATSCScannerProps {
  /** Current scanner state */
  state: ATSCScannerState;
  /** Scanner configuration */
  config: ATSCScanConfig;
  /** Current channel being scanned */
  currentChannel: ATSCChannel | null;
  /** Scan progress (0-100) */
  progress: number;
  /** List of found channels */
  foundChannels: StoredATSCChannel[];
  /** Callback to start scanning */
  onStartScan: () => void;
  /** Callback to pause scanning */
  onPauseScan: () => void;
  /** Callback to resume scanning */
  onResumeScan: () => void;
  /** Callback to stop scanning */
  onStopScan: () => void;
  /** Callback when config changes */
  onConfigChange: (updates: Partial<ATSCScanConfig>) => void;
  /** Callback to clear found channels */
  onClearChannels: () => void;
  /** Callback to export channels */
  onExportChannels: () => void;
  /** Whether device is available */
  deviceAvailable: boolean;
  /** Optional callback to tune to a found channel */
  onTuneToChannel?: (frequency: number) => void;
}

/**
 * ATSC Scanner Component
 * Provides UI for automated ATSC channel scanning with pilot tone detection
 */
function ATSCScanner({
  state,
  config,
  currentChannel,
  progress,
  foundChannels,
  onStartScan,
  onPauseScan,
  onResumeScan,
  onStopScan,
  onConfigChange,
  onClearChannels,
  onExportChannels,
  deviceAvailable,
  onTuneToChannel,
}: ATSCScannerProps): React.JSX.Element {
  const isScanning = state === "scanning";
  const isPaused = state === "paused";
  const isIdle = state === "idle";

  /**
   * Format frequency for display
   */
  const formatFrequency = (freqHz: number): string => {
    return `${(freqHz / 1e6).toFixed(1)} MHz`;
  };

  /**
   * Format signal quality
   */
  const formatSignalQuality = (channel: StoredATSCChannel): string => {
    const parts: string[] = [];
    if (channel.pilotDetected) parts.push("Pilot");
    if (channel.syncLocked) parts.push("Sync");
    if (channel.mer !== undefined) parts.push(`MER: ${channel.mer.toFixed(1)} dB`);
    if (parts.length === 0) return "Signal detected";
    return parts.join(", ");
  };

  return (
    <div className="card">
      <h2>ATSC Channel Scanner</h2>
      <p className="scanner-description">
        Scan VHF and UHF frequencies to find active ATSC (digital TV) broadcasts.
        Detects pilot tones and measures signal quality.
      </p>

      {/* Configuration Section */}
      <div className="scanner-config">
        <div className="config-section">
          <h3>Bands to Scan</h3>
          <div className="checkbox-group">
            <label>
              <input
                type="checkbox"
                checked={config.scanVHFLow}
                onChange={(e) =>
                  onConfigChange({ scanVHFLow: e.target.checked })
                }
                disabled={!isIdle}
              />
              VHF-Low (Ch 2-6: 54-88 MHz)
            </label>
            <label>
              <input
                type="checkbox"
                checked={config.scanVHFHigh}
                onChange={(e) =>
                  onConfigChange({ scanVHFHigh: e.target.checked })
                }
                disabled={!isIdle}
              />
              VHF-High (Ch 7-13: 174-216 MHz)
            </label>
            <label>
              <input
                type="checkbox"
                checked={config.scanUHF}
                onChange={(e) => onConfigChange({ scanUHF: e.target.checked })}
                disabled={!isIdle}
              />
              UHF (Ch 14-36: 470-608 MHz)
            </label>
          </div>
        </div>

        <div className="config-section">
          <h3>Detection Settings</h3>
          <div className="form-group">
            <label htmlFor="threshold">
              Threshold ({config.thresholdDb} dB above noise):
              <input
                id="threshold"
                type="number"
                value={config.thresholdDb}
                onChange={(e) =>
                  onConfigChange({ thresholdDb: parseFloat(e.target.value) })
                }
                min="5"
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
                step="50"
                min="100"
                max="2000"
              />
            </label>
          </div>

          <div className="checkbox-group">
            <label>
              <input
                type="checkbox"
                checked={config.requirePilot}
                onChange={(e) =>
                  onConfigChange({ requirePilot: e.target.checked })
                }
                disabled={!isIdle}
              />
              Require pilot tone detection
            </label>
            <label>
              <input
                type="checkbox"
                checked={config.requireSync}
                onChange={(e) =>
                  onConfigChange({ requireSync: e.target.checked })
                }
                disabled={!isIdle}
              />
              Require sync lock (slower but more accurate)
            </label>
          </div>
        </div>
      </div>

      {/* Control Buttons */}
      <div className="scanner-controls">
        {isIdle && (
          <button
            className="btn btn-primary"
            onClick={onStartScan}
            disabled={
              !deviceAvailable ||
              (!config.scanVHFLow && !config.scanVHFHigh && !config.scanUHF)
            }
            title={
              deviceAvailable
                ? "Start ATSC channel scan"
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
            {currentChannel && (
              <span>
                Scanning: {formatATSCChannel(currentChannel)} (
                {progress.toFixed(1)}%)
              </span>
            )}
          </div>
        </div>
      )}

      {/* Found Channels List */}
      <div className="found-channels">
        <div className="channels-header">
          <h3>Found Channels ({foundChannels.length})</h3>
          <div className="channels-actions">
            {foundChannels.length > 0 && (
              <>
                <button
                  className="btn btn-secondary"
                  onClick={onExportChannels}
                  title="Export channels to JSON file"
                >
                  Export
                </button>
                <button
                  className="btn btn-secondary"
                  onClick={onClearChannels}
                  title="Clear channels list"
                >
                  Clear
                </button>
              </>
            )}
          </div>
        </div>

        {foundChannels.length === 0 ? (
          <p className="empty-state">
            No ATSC channels detected yet. Start a scan to find broadcasts.
          </p>
        ) : (
          <div className="channels-list">
            <table>
              <thead>
                <tr>
                  <th>Channel</th>
                  <th>Frequency</th>
                  <th>Band</th>
                  <th>Strength</th>
                  <th>SNR</th>
                  <th>Quality</th>
                  <th>Discovered</th>
                  {onTuneToChannel && <th>Actions</th>}
                </tr>
              </thead>
              <tbody>
                {[...foundChannels]
                  .sort((a, b) => b.strength - a.strength)
                  .map((channel) => (
                    <tr key={channel.channel.channel}>
                      <td className="channel-number">
                        {channel.channel.channel}
                      </td>
                      <td>{formatFrequency(channel.channel.frequency)}</td>
                      <td>
                        <span className={`band-badge ${channel.channel.band.toLowerCase()}`}>
                          {channel.channel.band}
                        </span>
                      </td>
                      <td>
                        <div className="strength-indicator">
                          <div
                            className="strength-bar"
                            style={{
                              width: `${channel.strength * 100}%`,
                              backgroundColor:
                                channel.strength > 0.7
                                  ? "#10b981"
                                  : channel.strength > 0.4
                                    ? "#f59e0b"
                                    : "#ef4444",
                            }}
                          />
                          <span>{(channel.strength * 100).toFixed(0)}%</span>
                        </div>
                      </td>
                      <td>{channel.snr.toFixed(1)} dB</td>
                      <td>
                        <div className="quality-info">
                          {formatSignalQuality(channel)}
                        </div>
                      </td>
                      <td>{channel.discoveredAt.toLocaleString()}</td>
                      {onTuneToChannel && (
                        <td>
                          <button
                            className="btn btn-sm btn-primary"
                            onClick={() =>
                              onTuneToChannel(channel.channel.frequency)
                            }
                            title="Tune to this channel"
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
        .scanner-description {
          color: #9ca3af;
          margin-bottom: 1.5rem;
          font-size: 0.875rem;
        }

        .scanner-config {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
          gap: 1.5rem;
          margin-bottom: 1.5rem;
          padding: 1rem;
          background: #1f2937;
          border-radius: 0.5rem;
        }

        .config-section h3 {
          margin: 0 0 1rem 0;
          font-size: 1rem;
          color: #f9fafb;
        }

        .checkbox-group {
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
        }

        .checkbox-group label {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          font-size: 0.875rem;
          cursor: pointer;
        }

        .checkbox-group input[type="checkbox"] {
          cursor: pointer;
        }

        .form-group {
          margin-bottom: 1rem;
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
          background: #111827;
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

        .found-channels {
          margin-top: 1.5rem;
        }

        .channels-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 1rem;
        }

        .channels-header h3 {
          margin: 0;
          font-size: 1.125rem;
        }

        .channels-actions {
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

        .channels-list {
          overflow-x: auto;
        }

        .channels-list table {
          width: 100%;
          border-collapse: collapse;
          font-size: 0.875rem;
        }

        .channels-list th {
          text-align: left;
          padding: 0.75rem;
          background: #1f2937;
          font-weight: 600;
          border-bottom: 2px solid #374151;
        }

        .channels-list td {
          padding: 0.75rem;
          border-bottom: 1px solid #374151;
        }

        .channels-list tr:hover {
          background: #1f2937;
        }

        .channel-number {
          font-size: 1rem;
          font-weight: 600;
          color: #60a5fa;
          font-family: monospace;
        }

        .band-badge {
          display: inline-block;
          padding: 0.125rem 0.5rem;
          border-radius: 0.25rem;
          font-size: 0.75rem;
          font-weight: 600;
          text-transform: uppercase;
        }

        .band-badge.vhf-low {
          background: #3b82f6;
          color: #fff;
        }

        .band-badge.vhf-high {
          background: #8b5cf6;
          color: #fff;
        }

        .band-badge.uhf {
          background: #10b981;
          color: #000;
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

        .quality-info {
          font-size: 0.75rem;
          color: #9ca3af;
        }

        @media (max-width: 768px) {
          .scanner-config {
            grid-template-columns: 1fr;
          }

          .channels-header {
            flex-direction: column;
            align-items: flex-start;
            gap: 0.5rem;
          }
        }
      `}</style>
    </div>
  );
}

export default ATSCScanner;
