import { useState, useEffect } from "react";
import { useDevice } from "../contexts/DeviceContext";

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
  const [sampleRate, setSampleRate] = useState<number | null>(null);
  const [bufferHealth, setBufferHealth] = useState<number>(100);
  const [isRecording] = useState(false);

  // Get sample rate from device
  useEffect(() => {
    if (device?.getSampleRate) {
      device
        .getSampleRate()
        .then(setSampleRate)
        .catch(() => setSampleRate(null));
    }
  }, [device]);

  // Buffer health monitoring (simplified for now)
  useEffect(() => {
    const interval = setInterval(() => {
      // TODO: Connect to actual buffer monitoring system
      setBufferHealth(100);
    }, 1000);
    return (): void => {
      clearInterval(interval);
    };
  }, []);

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
    // TODO: Implement quick record toggle
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
          <span className="status-value">{formatSampleRate(sampleRate)}</span>
        </span>

        <span className="status-item">
          <span className="status-label">Buffer:</span>
          <span
            className={`status-value ${bufferHealth < 80 ? "status-warning" : ""}`}
          >
            {bufferHealth}%
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
