import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useDevice } from "../contexts/DeviceContext";
import { useStatusMetrics } from "../hooks/useStatusMetrics";

/**
 * TopAppBar component - Global status and quick actions
 *
 * According to ADR-0018, displays:
 * - Connection status (device connected/disconnected)
 * - Sample rate (current sampling rate)
 * - Buffer health (buffer fill level, overruns)
 * - Global errors (critical issues)
 * - Quick Record toggle button
 *
 * Integrates with:
 * - useDevice hook for device state
 * - Device capabilities for sample rate
 * - Future: recording system for quick record
 */
type TopAppBarProps = {
  /**
   * When true, render this component as the document banner landmark.
   * In the full App shell, pass false so the page header owns the banner role.
   */
  asBanner?: boolean;
};

function TopAppBar({ asBanner = true }: TopAppBarProps): React.JSX.Element {
  const { device } = useDevice();
  const navigate = useNavigate();
  // Reuse the centralized status metrics used by StatusBar for consistency
  const metrics = useStatusMetrics();
  const [isRecording] = useState(false);

  const formatSampleRate = (rate: number | null): string => {
    if (!rate) {
      return "--";
    }
    return `${(rate / 1e6).toFixed(2)} MSPS`;
  };

  const getConnectionStatus = (): {
    text: string;
    className: string;
  } => {
    if (!device) {
      return { text: "No Device", className: "status-disconnected" };
    }
    if (device.isOpen()) {
      return { text: "Connected", className: "status-connected" };
    }
    return { text: "Disconnected", className: "status-disconnected" };
  };

  const handleQuickRecord = (): void => {
    // Navigate to Monitor page and focus the Recording panel
    void navigate("/monitor#recording");
    // Fire a lightweight custom event to allow pages to optionally react
    try {
      window.dispatchEvent(new CustomEvent("rad:focus-recording"));
    } catch {
      // no-op
    }
  };

  const status = getConnectionStatus();

  return (
    <div
      className="top-app-bar"
      role={asBanner ? "banner" : "region"}
      aria-label={asBanner ? undefined : "Application status"}
    >
      <section aria-label="Device Status" className="status-section">
        <span className="status-item">
          <span className="status-label">Device:</span>
          <span className={`status-value ${status.className}`}>
            {status.text}
          </span>
        </span>

        <span className="status-item">
          <span className="status-label">Sample Rate:</span>
          <span className="status-value">{formatSampleRate(metrics.sampleRate)}</span>
        </span>

        <span className="status-item">
          <span className="status-label">Buffer:</span>
          <span
            className={`status-value ${metrics.bufferHealth < 80 ? "status-warning" : ""}`}
          >
            {metrics.bufferHealth}%
          </span>
        </span>
      </section>

      <section aria-label="Quick Actions" className="actions-section">
        <button
          className={`record-button ${isRecording ? "recording" : ""}`}
          onClick={handleQuickRecord}
          aria-label={isRecording ? "Stop recording" : "Start recording"}
          title="Quick record toggle (Keyboard: R)"
          disabled
        >
          {isRecording ? "⏹ Stop" : "⏺ Record"}
        </button>
      </section>
    </div>
  );
}

export default TopAppBar;
