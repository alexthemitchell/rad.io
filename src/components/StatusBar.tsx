import { useEffect, useState } from "react";

/**
 * Rendering tier detected for visualization components
 */
export enum RenderTier {
  WebGPU = "WebGPU",
  WebGL2 = "WebGL2",
  WebGL1 = "WebGL1",
  Worker = "Worker",
  Canvas2D = "Canvas2D",
  Unknown = "Unknown",
}

export interface StatusBarProps {
  /** Current rendering tier (WebGPU, WebGL2, etc.) */
  renderTier?: RenderTier;
  /** Frames per second (0-60+) */
  fps?: number;
  /** Sample rate in Hz (e.g., 2048000) */
  sampleRate?: number;
  /** Buffer health percentage (0-100) */
  bufferHealth?: number;
  /** Storage used in bytes */
  storageUsed?: number;
  /** Storage quota in bytes */
  storageQuota?: number;
  /** Device connection status */
  deviceConnected?: boolean;
  /** Additional className for styling */
  className?: string;
}

/**
 * StatusBar displays critical system metrics at the bottom of the application.
 * Shows GPU rendering tier, FPS, sample rate, buffer health, and storage quota.
 *
 * Aligns with UI-DESIGN-SPEC.md section 2 (IA) and section 6 (Performance).
 *
 * @example
 * ```tsx
 * <StatusBar
 *   renderTier={RenderTier.WebGL2}
 *   fps={58}
 *   sampleRate={2048000}
 *   bufferHealth={95}
 *   storageUsed={52428800}
 *   storageQuota={104857600}
 *   deviceConnected={true}
 * />
 * ```
 */
function StatusBar({
  renderTier = RenderTier.Unknown,
  fps = 0,
  sampleRate = 0,
  bufferHealth = 100,
  storageUsed = 0,
  storageQuota = 0,
  deviceConnected = false,
  className = "",
}: StatusBarProps): React.JSX.Element {
  const [currentTime, setCurrentTime] = useState(new Date());

  // Update clock every second
  useEffect((): (() => void) => {
    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return (): void => clearInterval(interval);
  }, []);

  const formatSampleRate = (rate: number): string => {
    if (rate === 0) {
      return "—";
    }
    if (rate >= 1e6) {
      return `${(rate / 1e6).toFixed(2)} MS/s`;
    }
    if (rate >= 1e3) {
      return `${(rate / 1e3).toFixed(0)} kS/s`;
    }
    return `${rate} S/s`;
  };

  const formatStorage = (used: number, quota: number): string => {
    if (quota === 0) {
      return "—";
    }
    const usedMB = used / 1024 / 1024;
    const quotaMB = quota / 1024 / 1024;
    const percent = ((used / quota) * 100).toFixed(0);
    return `${usedMB.toFixed(1)} / ${quotaMB.toFixed(0)} MB (${percent}%)`;
  };

  const formatTime = (date: Date): string => {
    return date.toLocaleTimeString("en-US", { hour12: false });
  };

  const getRenderTierColor = (tier: RenderTier): string => {
    switch (tier) {
      case RenderTier.WebGPU:
        return "#4ade80"; // Success green
      case RenderTier.WebGL2:
        return "#5aa3e8"; // Electric blue
      case RenderTier.WebGL1:
        return "#fbbf24"; // Warning amber
      case RenderTier.Worker:
        return "#fb923c"; // Orange
      case RenderTier.Canvas2D:
        return "#f87171"; // Soft red
      case RenderTier.Unknown:
      default:
        return "#9ca3af"; // Gray
    }
  };

  const getBufferHealthColor = (health: number): string => {
    if (health >= 80) {
      return "#4ade80"; // Good
    }
    if (health >= 50) {
      return "#fbbf24"; // Warning
    }
    return "#ef4444"; // Critical
  };

  const getStorageColor = (used: number, quota: number): string => {
    if (quota === 0) {
      return "#9ca3af";
    }
    const percent = (used / quota) * 100;
    if (percent >= 90) {
      return "#ef4444"; // Critical
    }
    if (percent >= 70) {
      return "#fbbf24"; // Warning
    }
    return "#4ade80"; // Good
  };

  return (
    <div
      className={`status-bar ${className}`}
      role="status"
      aria-live="polite"
      aria-atomic="false"
    >
      <div className="status-bar-item">
        <span className="status-bar-label">Device</span>
        <span
          className="status-bar-value"
          style={{ color: deviceConnected ? "#4ade80" : "#ef4444" }}
        >
          {deviceConnected ? "Connected" : "Disconnected"}
        </span>
      </div>

      <div className="status-bar-separator" aria-hidden="true" />

      <div className="status-bar-item">
        <span className="status-bar-label">GPU</span>
        <span
          className="status-bar-value"
          style={{ color: getRenderTierColor(renderTier) }}
          title={`Rendering with ${renderTier}`}
        >
          {renderTier}
        </span>
      </div>

      <div className="status-bar-separator" aria-hidden="true" />

      <div className="status-bar-item">
        <span className="status-bar-label">FPS</span>
        <span
          className="status-bar-value status-bar-mono"
          style={{
            color: fps >= 55 ? "#4ade80" : fps >= 30 ? "#fbbf24" : "#ef4444",
          }}
          title="Frames per second"
        >
          {fps.toFixed(0)}
        </span>
      </div>

      <div className="status-bar-separator" aria-hidden="true" />

      <div className="status-bar-item">
        <span className="status-bar-label">Sample Rate</span>
        <span
          className="status-bar-value status-bar-mono"
          title={`${sampleRate} samples/second`}
        >
          {formatSampleRate(sampleRate)}
        </span>
      </div>

      <div className="status-bar-separator" aria-hidden="true" />

      <div className="status-bar-item">
        <span className="status-bar-label">Buffer</span>
        <span
          className="status-bar-value status-bar-mono"
          style={{ color: getBufferHealthColor(bufferHealth) }}
          title={`Buffer health: ${bufferHealth}%`}
        >
          {bufferHealth.toFixed(0)}%
        </span>
      </div>

      <div className="status-bar-separator" aria-hidden="true" />

      <div className="status-bar-item">
        <span className="status-bar-label">Storage</span>
        <span
          className="status-bar-value status-bar-mono"
          style={{ color: getStorageColor(storageUsed, storageQuota) }}
          title="Storage used / quota"
        >
          {formatStorage(storageUsed, storageQuota)}
        </span>
      </div>

      <div className="status-bar-spacer" />

      <div className="status-bar-item">
        <span
          className="status-bar-value status-bar-mono"
          title="Current time (UTC)"
        >
          {formatTime(currentTime)}
        </span>
      </div>
    </div>
  );
}

export default StatusBar;
