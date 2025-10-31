import { useEffect, useMemo, useState } from "react";
import { useDeviceContext } from "../contexts/DeviceContext";
import { WebUSBDeviceSelector, SDRDriverRegistry } from "../drivers";
import { RenderTier } from "../types/rendering";
import { extractUSBDevice, formatUsbId } from "../utils/usb";
/** Rendering tier detected for visualization components */
// Re-export for backward compatibility with existing imports/tests
export { RenderTier } from "../types/rendering";

export interface StatusBarProps {
  /** Optional high-level status message (e.g., from current page) */
  message?: string;
  /** Current rendering tier (WebGPU, WebGL2, etc.) */
  renderTier?: RenderTier;
  /** Frames per second (0-60+) */
  fps?: number;
  /** Input data cadence FPS (viz-push) */
  inputFps?: number;
  /** Estimated dropped frames over recent window */
  droppedFrames?: number;
  /** p95 render duration for 'rendering' measures (ms) */
  renderP95Ms?: number;
  /** Count of long tasks observed (PerformanceObserver) */
  longTasks?: number;
  /** Sample rate in Hz (e.g., 2048000) */
  sampleRate?: number;
  /** Buffer health percentage (0-100) */
  bufferHealth?: number;
  /** Optional buffer details for expanded metrics */
  bufferDetails?: { currentSamples: number; maxSamples: number };
  /** Storage used in bytes */
  storageUsed?: number;
  /** Storage quota in bytes */
  storageQuota?: number;
  /** Device connection status */
  deviceConnected?: boolean;
  /** Audio state for speaker output */
  audioState?: "unavailable" | "suspended" | "idle" | "playing" | "muted";
  /** Current volume percent (0-100) */
  audioVolume?: number;
  /** Whether recent audio appeared to clip */
  audioClipping?: boolean;
  /** Additional className for styling */
  className?: string;
  /** Open the Rendering Settings modal */
  onOpenRenderingSettings?: () => void;
}

// Custom hook to safely consume DeviceContext, returning defaults if provider is missing
function useOptionalDeviceContext(): {
  primaryDevice: unknown;
  connectPairedUSBDevice: (usb: USBDevice) => Promise<void>;
  requestDevice: () => Promise<void>;
  isCheckingPaired: boolean;
} {
  try {
    return useDeviceContext();
  } catch {
    return {
      primaryDevice: undefined,
      connectPairedUSBDevice: async (_usb: USBDevice): Promise<void> => {
        await Promise.resolve();
      },
      requestDevice: async (): Promise<void> => {
        await Promise.resolve();
      },
      isCheckingPaired: false,
    };
  }
}

// Helper to compute a stable key for a USB device
function deviceKey(usb: USBDevice): string {
  return `${usb.vendorId}:${usb.productId}:${usb.serialNumber ?? "__no_serial__"}`;
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
  message,
  renderTier = RenderTier.Unknown,
  fps = 0,
  inputFps = 0,
  droppedFrames,
  renderP95Ms = 0,
  longTasks = 0,
  sampleRate = 0,
  bufferHealth = 100,
  bufferDetails,
  storageUsed = 0,
  storageQuota = 0,
  deviceConnected = false,
  audioState = "unavailable",
  audioVolume,
  audioClipping = false,
  className = "",
  onOpenRenderingSettings,
}: StatusBarProps): React.JSX.Element {
  const [currentTime, setCurrentTime] = useState(new Date());

  const {
    primaryDevice,
    connectPairedUSBDevice,
    requestDevice,
    isCheckingPaired,
  } = useOptionalDeviceContext();

  // Enumerated list of previously paired and supported USB devices
  const [pairedUSBDevices, setPairedUSBDevices] = useState<USBDevice[] | null>(
    null,
  );

  // Selected device key in the dropdown (tracks current primary device)
  const selectedKey = useMemo(() => {
    const usb = extractUSBDevice(primaryDevice);
    return usb ? deviceKey(usb) : "";
  }, [primaryDevice]);

  const primaryUSB = useMemo(
    () => extractUSBDevice(primaryDevice),
    [primaryDevice],
  );

  // Enumerate paired devices (similar to Devices panel)
  useEffect(() => {
    const enumerate = async (): Promise<void> => {
      if (isCheckingPaired) {
        setPairedUSBDevices(null);
        return;
      }
      try {
        const selector = new WebUSBDeviceSelector();
        const paired = await selector.getDevices();
        const supported = paired.filter((usb) =>
          Boolean(SDRDriverRegistry.getDriverForDevice(usb)),
        );
        setPairedUSBDevices(supported);
      } catch (err) {
        console.error(
          "StatusBar: Failed to enumerate paired USB devices:",
          err,
        );
        setPairedUSBDevices([]);
      }
    };
    void enumerate();
  }, [isCheckingPaired, primaryDevice]);

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
        return "var(--rad-success)"; // Success green
      case RenderTier.WebGL2:
        return "var(--rad-primary)"; // Primary electric blue
      case RenderTier.WebGL1:
        return "var(--rad-warning)"; // Warning amber
      case RenderTier.Worker:
        return "var(--rad-warning)"; // Map to warning
      case RenderTier.Canvas2D:
        return "var(--rad-danger)"; // Critical
      case RenderTier.Unknown:
      default:
        return "var(--rad-fg-muted)"; // Muted
    }
  };

  const getBufferHealthColor = (health: number): string => {
    if (health >= 80) {
      return "var(--rad-success)"; // Good
    }
    if (health >= 50) {
      return "var(--rad-warning)"; // Warning
    }
    return "var(--rad-danger)"; // Critical
  };

  const getStorageColor = (used: number, quota: number): string => {
    if (quota === 0) {
      return "var(--rad-fg-muted)";
    }
    const percent = (used / quota) * 100;
    if (percent >= 90) {
      return "var(--rad-danger)"; // Critical
    }
    if (percent >= 70) {
      return "var(--rad-warning)"; // Warning
    }
    return "var(--rad-success)"; // Good
  };

  const getAudioColor = (
    state: StatusBarProps["audioState"],
    clipping: boolean,
  ): string => {
    if (state === "muted" || state === "unavailable") {
      return "var(--rad-fg-muted)";
    }
    if (state === "suspended") {
      return "var(--rad-warning)";
    }
    if (clipping) {
      return "var(--rad-danger)";
    }
    if (state === "playing") {
      return "var(--rad-success)";
    }
    return "var(--rad-fg-muted)";
  };

  const [showBufferDetails, setShowBufferDetails] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);

  return (
    <div
      className={`status-bar ${className}`}
      role="status"
      aria-live="polite"
      aria-atomic="false"
    >
      {message ? (
        <div className="status-bar-item">
          <span className="status-bar-value">{message}</span>
        </div>
      ) : null}
      <div className="status-bar-item">
        <span className="status-bar-label">Device</span>
        {Array.isArray(pairedUSBDevices) && pairedUSBDevices.length > 1 ? (
          <select
            aria-label="Select SDR device"
            className="status-bar-value"
            value={selectedKey}
            onChange={(e): void => {
              const key = e.target.value;
              const next = pairedUSBDevices.find((u) => deviceKey(u) === key);
              if (next) {
                void connectPairedUSBDevice(next);
              }
            }}
            style={{
              marginLeft: 6,
              padding: "2px 6px",
              background: "transparent",
              border: "1px solid var(--rad-border)",
              color: deviceConnected
                ? "var(--rad-success)"
                : "var(--rad-danger)",
            }}
            title={
              deviceConnected
                ? "Switch between paired SDR devices"
                : "Select a paired SDR device to connect"
            }
          >
            {/* Placeholder when no device is currently selected */}
            {!deviceConnected && (
              <option value="" disabled>
                Select device…
              </option>
            )}
            {/* Ensure the current selection is present even if enumeration is slow */}
            {selectedKey &&
            !pairedUSBDevices.some((u) => deviceKey(u) === selectedKey) ? (
              <option value={selectedKey}>Current device</option>
            ) : null}
            {pairedUSBDevices.map((usb) => {
              const visible = `${usb.productName ?? "Unknown Device"} (${formatUsbId(usb.vendorId, usb.productId)})`;
              const tooltip = `${usb.productName ?? "Unknown Device"} • ${formatUsbId(usb.vendorId, usb.productId)}${usb.serialNumber ? ` • SN: ${usb.serialNumber}` : ""}`;
              return (
                <option
                  key={deviceKey(usb)}
                  value={deviceKey(usb)}
                  title={tooltip}
                >
                  {visible}
                </option>
              );
            })}
          </select>
        ) : (
          <span
            className="status-bar-value"
            title={
              primaryUSB
                ? `${primaryUSB.productName ?? "Unknown Device"} • ${formatUsbId(primaryUSB.vendorId, primaryUSB.productId)}${primaryUSB.serialNumber ? ` • SN: ${primaryUSB.serialNumber}` : ""}`
                : undefined
            }
          >
            {deviceConnected ? "Connected" : "Disconnected"}
          </span>
        )}

        {/* Connect affordance lives in the StatusBar when not connected */}
        {!deviceConnected ? (
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => {
              setIsConnecting(true);
              void requestDevice()
                .catch((err: unknown) => {
                  console.error("StatusBar: Failed to request device", err);
                })
                .finally(() => {
                  setIsConnecting(false);
                });
            }}
            disabled={isCheckingPaired || isConnecting}
            aria-label="Connect SDR device via WebUSB"
            title={
              isCheckingPaired
                ? "Checking for previously paired devices..."
                : "Click to connect your SDR device via WebUSB"
            }
            style={{ marginLeft: 8, padding: "2px 8px" }}
          >
            {isConnecting ? "Connecting…" : "Connect…"}
          </button>
        ) : null}
      </div>

      <div className="status-bar-separator" aria-hidden="true" />

      <div className="status-bar-item">
        <span className="status-bar-label">GPU</span>
        {typeof onOpenRenderingSettings === "function" ? (
          <button
            type="button"
            className="status-bar-value"
            onClick={onOpenRenderingSettings}
            style={{
              color: getRenderTierColor(renderTier),
              background: "transparent",
              border: "none",
              cursor: "pointer",
              padding: 0,
              textDecoration: "underline",
              textUnderlineOffset: 2,
            }}
            aria-label={`Rendering with ${renderTier}. Open rendering settings.`}
            title={`Rendering with ${renderTier} • Click for settings`}
          >
            {renderTier}
          </button>
        ) : (
          <span
            className="status-bar-value"
            style={{ color: getRenderTierColor(renderTier) }}
            title={`Rendering with ${renderTier}`}
          >
            {renderTier}
          </span>
        )}
      </div>

      <div className="status-bar-separator" aria-hidden="true" />

      <div className="status-bar-item">
        <span className="status-bar-label">FPS</span>
        <span
          className="status-bar-value status-bar-mono"
          title="Frames per second"
        >
          {fps.toFixed(0)}
        </span>
      </div>

      {typeof inputFps === "number" && inputFps > 0 ? (
        <>
          <div className="status-bar-separator" aria-hidden="true" />

          <div className="status-bar-item">
            <span className="status-bar-label">Input</span>
            <span
              className="status-bar-value status-bar-mono"
              title="Visualization input cadence (fps)"
            >
              {inputFps.toFixed(0)}
            </span>
          </div>
        </>
      ) : null}

      <div className="status-bar-separator" aria-hidden="true" />

      <div className="status-bar-item">
        <span className="status-bar-label">Render p95</span>
        <span
          className="status-bar-value status-bar-mono"
          title="95th percentile render time (ms)"
        >
          {renderP95Ms.toFixed(1)} ms
        </span>
      </div>

      <div className="status-bar-separator" aria-hidden="true" />

      <div className="status-bar-item">
        <span className="status-bar-label">Tasks</span>
        <span
          className="status-bar-value status-bar-mono"
          title="Long tasks observed"
        >
          {longTasks}
        </span>
      </div>

      {typeof droppedFrames === "number" ? (
        <>
          <div className="status-bar-separator" aria-hidden="true" />
          <div className="status-bar-item">
            <span className="status-bar-label">Dropped</span>
            <span
              className="status-bar-value status-bar-mono"
              title="Estimated dropped frames (last 60s)"
            >
              {Math.max(0, Math.round(droppedFrames))}
            </span>
          </div>
        </>
      ) : null}

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
          title={`Buffer health: ${bufferHealth}%`}
        >
          {bufferHealth.toFixed(0)}%
        </span>
        {bufferDetails ? (
          <button
            type="button"
            aria-label="Show buffer details"
            aria-expanded={showBufferDetails}
            onClick={(): void => setShowBufferDetails((v) => !v)}
            style={{
              marginLeft: 4,
              fontSize: "0.8em",
              lineHeight: 1,
              padding: "2px 6px",
            }}
            title={`${bufferDetails.currentSamples.toLocaleString()} / ${bufferDetails.maxSamples.toLocaleString()} samples (${Math.round((bufferDetails.currentSamples / bufferDetails.maxSamples) * 100)}%)`}
          >
            ⓘ
          </button>
        ) : null}
        {showBufferDetails && bufferDetails ? (
          <span
            className="status-bar-value status-bar-mono"
            style={{ marginLeft: 6, opacity: 0.9 }}
          >
            {bufferDetails.currentSamples.toLocaleString()} /
            {bufferDetails.maxSamples.toLocaleString()} (
            {Math.round(
              (bufferDetails.currentSamples / bufferDetails.maxSamples) * 100,
            )}
            %)
          </span>
        ) : null}
      </div>

      <div className="status-bar-separator" aria-hidden="true" />

      <div className="status-bar-item">
        <span className="status-bar-label">Storage</span>
        <span
          className="status-bar-value status-bar-mono"
          title="Storage used / quota"
        >
          {formatStorage(storageUsed, storageQuota)}
        </span>
      </div>

      <div className="status-bar-spacer" />

      <div className="status-bar-item">
        <span className="status-bar-label">Audio</span>
        <span
          className="status-bar-value"
          title={`Audio ${audioState}${typeof audioVolume === "number" ? ` • Vol ${audioVolume}%` : ""}${audioClipping ? " • Clipping" : ""}`}
        >
          {audioState === "muted"
            ? "Muted"
            : audioState === "playing"
              ? "Playing"
              : audioState === "suspended"
                ? "Suspended"
                : audioState === "idle"
                  ? "Idle"
                  : "Unavailable"}
          {typeof audioVolume === "number" ? (
            <span className="status-bar-mono" style={{ marginLeft: 6 }}>
              {audioVolume}%
            </span>
          ) : null}
          {audioClipping ? (
            <span
              aria-label="Audio clipping"
              title="Audio clipping"
              style={{ marginLeft: 6 }}
            >
              ⚠
            </span>
          ) : null}
        </span>
      </div>

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
