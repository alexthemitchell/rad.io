import { useState, useCallback } from "react";
import DeviceDiagnostics from "./DeviceDiagnostics";
import type { ISDRDevice } from "../models/SDRDevice";

interface DeviceControlBarProps {
  device?: ISDRDevice;
  listening: boolean;
  isInitializing: boolean;
  isCheckingPaired?: boolean;
  deviceError?: Error | null;
  frequency?: number;
  onConnect: () => Promise<void>;
  onStartReception: () => Promise<void>;
  onStopReception: () => Promise<void>;
  onResetDevice?: () => Promise<void>;
  isResetting?: boolean;
  /**
   * Whether to show the Connect control. Defaults to true.
   * Set to false when connect is handled elsewhere (e.g., StatusBar).
   */
  showConnect?: boolean;
}

/**
 * DeviceControlBar Component
 *
 * A shared control bar for managing SDR device connection and reception.
 * Appears at the top of all pages to provide consistent device control
 * regardless of which page the user is viewing.
 *
 * Features:
 * - Connect/Disconnect device
 * - Start/Stop reception
 * - Expandable device diagnostics
 * - Device reset functionality
 */
export function DeviceControlBar({
  device,
  listening,
  isInitializing,
  isCheckingPaired = false,
  deviceError,
  frequency,
  onConnect,
  onStartReception,
  onStopReception,
  onResetDevice,
  isResetting = false,
  showConnect = true,
}: DeviceControlBarProps): React.JSX.Element {
  const [diagnosticsExpanded, setDiagnosticsExpanded] = useState(false);

  const handleConnect = useCallback(async () => {
    try {
      await onConnect();
    } catch (error) {
      console.error("DeviceControlBar: Failed to connect device", error, {
        errorType: error instanceof Error ? error.name : typeof error,
        errorMessage: error instanceof Error ? error.message : String(error),
      });
    }
  }, [onConnect]);

  const handleStartReception = useCallback(async () => {
    try {
      await onStartReception();
    } catch (error) {
      console.error("DeviceControlBar: Failed to start reception", error, {
        errorType: error instanceof Error ? error.name : typeof error,
        hasDevice: Boolean(device),
        deviceState: device?.getCapabilities(),
      });
    }
  }, [onStartReception, device]);

  const handleStopReception = useCallback(async () => {
    try {
      await onStopReception();
    } catch (error) {
      console.error("DeviceControlBar: Failed to stop reception", error, {
        errorType: error instanceof Error ? error.name : typeof error,
      });
    }
  }, [onStopReception]);

  const toggleDiagnostics = useCallback(() => {
    setDiagnosticsExpanded((prev) => !prev);
  }, []);

  return (
    <div className="device-control-bar">
      <div
        className="device-control-actions"
        role="toolbar"
        aria-label="Device control actions"
      >
        {!device && showConnect && (
          <button
            className="btn btn-primary"
            onClick={() => void handleConnect()}
            disabled={isInitializing || isCheckingPaired}
            title={
              isInitializing
                ? "Connecting to your SDR device. Please grant WebUSB access if prompted."
                : isCheckingPaired
                  ? "Checking for previously paired devices..."
                  : "Click to connect your SDR device via WebUSB. Ensure device is plugged in and browser supports WebUSB."
            }
            aria-label="Connect SDR device via WebUSB"
          >
            {isCheckingPaired
              ? "Checking for Device..."
              : isInitializing
                ? "Connecting..."
                : "🔌 Connect Device"}
          </button>
        )}

        {device && !listening && (
          <button
            className="btn btn-success"
            onClick={() => void handleStartReception()}
            disabled={isInitializing}
            title="Start receiving IQ samples from the SDR device. Visualizations will update with live data."
            aria-label="Start receiving radio signals"
          >
            ▶️ Start Reception
          </button>
        )}

        {device && listening && (
          <button
            className="btn btn-danger"
            onClick={() => void handleStopReception()}
            title="Stop receiving IQ samples and pause visualizations. Device remains connected."
            aria-label="Stop receiving radio signals"
          >
            ⏸️ Stop Reception
          </button>
        )}

        {device && (
          <button
            className="btn btn-secondary"
            onClick={toggleDiagnostics}
            aria-expanded={diagnosticsExpanded}
            aria-label="Toggle device diagnostics"
          >
            {diagnosticsExpanded
              ? "⬆️ Hide Diagnostics"
              : "⬇️ Show Diagnostics"}
          </button>
        )}

        {device && (
          <div className="device-status-badge">
            {listening ? (
              <span className="status-indicator status-active">
                🟢 Receiving
              </span>
            ) : (
              <span className="status-indicator status-idle">🟡 Connected</span>
            )}
          </div>
        )}

        {deviceError && (
          <div className="device-error-badge">
            <span className="status-indicator status-error">
              🔴 Device Error
            </span>
          </div>
        )}
      </div>

      {diagnosticsExpanded && device && (
        <div className="device-diagnostics-panel">
          <DeviceDiagnostics
            device={device}
            isListening={listening}
            frequency={frequency}
            error={deviceError}
            onResetDevice={onResetDevice}
            isResetting={isResetting}
          />
        </div>
      )}
    </div>
  );
}

export default DeviceControlBar;
