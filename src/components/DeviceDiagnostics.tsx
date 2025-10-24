import React from "react";
import type { ISDRDevice } from "../models";

interface DeviceDiagnosticsProps {
  device?: ISDRDevice;
  isListening: boolean;
  frequency?: number;
  error?: Error | null;
  onResetDevice?: () => void | Promise<void>;
  isResetting?: boolean;
}

interface DiagnosticItem {
  label: string;
  status: "ok" | "warning" | "error" | "info";
  message: string;
}

/**
 * DeviceDiagnostics Component
 *
 * Displays device configuration status and troubleshooting guidance.
 * Helps users diagnose connection and streaming issues.
 */
export function DeviceDiagnostics({
  device,
  isListening,
  frequency,
  error,
  onResetDevice,
  isResetting,
}: DeviceDiagnosticsProps): React.JSX.Element {
  const diagnostics: DiagnosticItem[] = [];

  // Device connection status
  if (!device) {
    diagnostics.push({
      label: "Device Connection",
      status: "info",
      message: "No device connected",
    });
  } else if (device.isOpen()) {
    diagnostics.push({
      label: "Device Connection",
      status: "ok",
      message: "Device connected and open",
    });
  } else {
    diagnostics.push({
      label: "Device Connection",
      status: "error",
      message: "Device connected but not open",
    });
  }

  // Streaming status
  if (device?.isOpen()) {
    if (isListening) {
      diagnostics.push({
        label: "Streaming Status",
        status: "ok",
        message: device.isReceiving()
          ? "Actively receiving data"
          : "Listening (waiting for data)",
      });
    } else {
      diagnostics.push({
        label: "Streaming Status",
        status: "info",
        message: "Not streaming",
      });
    }
  }

  // Frequency configuration
  if (frequency && device?.isOpen()) {
    const freqMHz = (frequency / 1e6).toFixed(2);
    diagnostics.push({
      label: "Frequency",
      status: "ok",
      message: `${freqMHz} MHz`,
    });
  } else if (device?.isOpen()) {
    diagnostics.push({
      label: "Frequency",
      status: "warning",
      message: "Not configured",
    });
  }

  // Error status
  if (error) {
    diagnostics.push({
      label: "Error",
      status: "error",
      message: error.message,
    });
  }

  const getStatusIcon = (status: DiagnosticItem["status"]): string => {
    switch (status) {
      case "ok":
        return "✓";
      case "warning":
        return "⚠";
      case "error":
        return "✗";
      case "info":
        return "ℹ";
    }
  };

  const getStatusColor = (status: DiagnosticItem["status"]): string => {
    switch (status) {
      case "ok":
        return "#4ade80"; // green
      case "warning":
        return "#fbbf24"; // yellow
      case "error":
        return "#ef4444"; // red
      case "info":
        return "#60a5fa"; // blue
    }
  };

  const hasError = diagnostics.some((d) => d.status === "error");
  const hasWarning = diagnostics.some((d) => d.status === "warning");

  // (debug removed)

  return (
    <div className="device-diagnostics">
      <div className="diagnostics-header">
        <h3>Device Diagnostics</h3>
        {hasError && (
          <span className="diagnostics-badge error">Issues Detected</span>
        )}
        {!hasError && hasWarning && (
          <span className="diagnostics-badge warning">Attention Needed</span>
        )}
        {!hasError && !hasWarning && device?.isOpen() && (
          <span className="diagnostics-badge ok">All Systems Operational</span>
        )}
      </div>

      <ul className="diagnostics-list">
        {diagnostics.map((item, index) => (
          <li key={index} className="diagnostic-item">
            <span
              className="diagnostic-icon"
              style={{ color: getStatusColor(item.status) }}
              aria-label={item.status}
            >
              {getStatusIcon(item.status)}
            </span>
            <div className="diagnostic-content">
              <strong>{item.label}:</strong> {item.message}
            </div>
          </li>
        ))}
      </ul>

      {hasError && error?.message.includes("Device not responding") && (
        <div className="troubleshooting-guide">
          <h4>Device Timeout - Reset Required</h4>
          <p>
            The device stopped responding. You can try a software reset without
            unplugging the device:
          </p>
          <button
            className="btn btn-primary"
            onClick={
              onResetDevice ? (): void => void onResetDevice() : undefined
            }
            disabled={!onResetDevice || Boolean(isResetting)}
            style={{ marginTop: "10px" }}
            title={
              !onResetDevice
                ? "Reset action unavailable in this build"
                : undefined
            }
          >
            {isResetting ? "Resetting Device..." : "🔄 Reset Device"}
          </button>
          <h5 style={{ marginTop: "15px" }}>
            If software reset doesn&apos;t work:
          </h5>
          <ol>
            <li>Unplug and replug the USB cable</li>
            <li>Press the reset button on your HackRF device</li>
            <li>Try a different USB port (preferably USB 3.0)</li>
            <li>
              Verify device works with CLI tools:
              <code>hackrf_info</code>
            </li>
            <li>Restart your browser</li>
          </ol>
        </div>
      )}

      {hasError && error?.message.includes("not open") && (
        <div className="troubleshooting-guide">
          <h4>Device Connection Issue:</h4>
          <p>
            The device is detected but not properly opened. Try disconnecting
            and reconnecting the device.
          </p>
        </div>
      )}

      {device?.isOpen() && !isListening && !hasError && (
        <div className="info-panel">
          <p>
            Device is ready. Click <strong>Start Reception</strong> to begin
            streaming.
          </p>
        </div>
      )}
    </div>
  );
}

export default DeviceDiagnostics;
