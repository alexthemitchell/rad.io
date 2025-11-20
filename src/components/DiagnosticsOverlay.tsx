/**
 * DiagnosticsOverlay Component
 *
 * Real-time health overlay displaying signal pipeline diagnostics.
 * Shows demodulator lock state, MER/BER/SNR, TS continuity errors,
 * decoder drop counts, and other error events.
 */

import React, { useCallback, useEffect, useRef, useState } from "react";
import { useDiagnostics, useDevice } from "../store";
import type {
  DiagnosticEvent,
  DemodulatorMetrics,
  TSParserMetrics,
  DecoderMetrics,
} from "../store";

interface DiagnosticsOverlayProps {
  /** Optional CSS class name */
  className?: string;
  /** Whether to show detailed metrics */
  detailed?: boolean;
}

/**
 * Format a metric value with appropriate precision
 */
function formatMetric(
  value: number | undefined,
  unit: string,
  decimals = 2,
): string {
  if (value === undefined || !isFinite(value)) {
    return "N/A";
  }
  return `${value.toFixed(decimals)} ${unit}`;
}

/**
 * Get status badge class based on value and thresholds
 */
function getStatusClass(
  value: number | undefined | boolean,
  goodThreshold?: number,
  warnThreshold?: number,
): string {
  if (typeof value === "boolean") {
    return value ? "status-good" : "status-bad";
  }
  if (value === undefined || !isFinite(value)) {
    return "status-unknown";
  }
  if (goodThreshold !== undefined && value >= goodThreshold) {
    return "status-good";
  }
  if (warnThreshold !== undefined && value >= warnThreshold) {
    return "status-warn";
  }
  return "status-bad";
}

/**
 * Demodulator metrics display
 */
function DemodulatorMetricsDisplay({
  metrics,
  detailed,
}: {
  metrics: DemodulatorMetrics | null;
  detailed: boolean;
}): React.JSX.Element {
  if (!metrics) {
    return (
      <div className="metrics-section">
        <h4>Demodulator</h4>
        <div className="metrics-grid">
          <div className="metric-item">
            <span className="metric-label">Status:</span>
            <span className="metric-value status-unknown">No Data</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="metrics-section">
      <h4>Demodulator</h4>
      <div className="metrics-grid">
        <div className="metric-item">
          <span className="metric-label">Sync Lock:</span>
          <span
            className={`metric-value ${getStatusClass(metrics.syncLocked)}`}
          >
            {metrics.syncLocked ? "Locked" : "Unlocked"}
          </span>
        </div>
        <div className="metric-item">
          <span className="metric-label">SNR:</span>
          <span
            className={`metric-value ${getStatusClass(metrics.snr, 15, 10)}`}
          >
            {formatMetric(metrics.snr, "dB", 1)}
          </span>
        </div>
        <div className="metric-item">
          <span className="metric-label">MER:</span>
          <span
            className={`metric-value ${getStatusClass(metrics.mer, 20, 15)}`}
          >
            {formatMetric(metrics.mer, "dB", 1)}
          </span>
        </div>
        <div className="metric-item">
          <span className="metric-label">BER:</span>
          <span
            className={`metric-value ${
              metrics.ber === undefined || !isFinite(metrics.ber)
                ? "status-unknown"
                : metrics.ber < 0.0001
                  ? "status-good"
                  : metrics.ber < 0.001
                    ? "status-warn"
                    : "status-bad"
            }`}
          >
            {metrics.ber !== undefined && isFinite(metrics.ber)
              ? metrics.ber.toExponential(2)
              : "N/A"}
          </span>
        </div>
        {detailed && (
          <>
            <div className="metric-item">
              <span className="metric-label">Signal Strength:</span>
              <span className="metric-value">
                {formatMetric(
                  metrics.signalStrength !== undefined
                    ? metrics.signalStrength * 100
                    : undefined,
                  "%",
                  0,
                )}
              </span>
            </div>
            <div className="metric-item">
              <span className="metric-label">Segment Syncs:</span>
              <span className="metric-value">
                {metrics.segmentSyncCount ?? "N/A"}
              </span>
            </div>
            <div className="metric-item">
              <span className="metric-label">Field Syncs:</span>
              <span className="metric-value">
                {metrics.fieldSyncCount ?? "N/A"}
              </span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/**
 * TS Parser metrics display
 */
function TSParserMetricsDisplay({
  metrics,
  detailed,
}: {
  metrics: TSParserMetrics | null;
  detailed: boolean;
}): React.JSX.Element {
  if (!metrics) {
    return (
      <div className="metrics-section">
        <h4>Transport Stream</h4>
        <div className="metrics-grid">
          <div className="metric-item">
            <span className="metric-label">Status:</span>
            <span className="metric-value status-unknown">No Data</span>
          </div>
        </div>
      </div>
    );
  }

  const errorRate =
    metrics.packetsProcessed > 0
      ? ((metrics.continuityErrors + metrics.teiErrors + metrics.syncErrors) /
          metrics.packetsProcessed) *
        100
      : 0;

  return (
    <div className="metrics-section">
      <h4>Transport Stream</h4>
      <div className="metrics-grid">
        <div className="metric-item">
          <span className="metric-label">Packets:</span>
          <span className="metric-value">{metrics.packetsProcessed}</span>
        </div>
        <div className="metric-item">
          <span className="metric-label">Error Rate:</span>
          <span
            className={`metric-value ${getStatusClass(100 - errorRate, 99, 95)}`}
          >
            {formatMetric(errorRate, "%", 2)}
          </span>
        </div>
        <div className="metric-item">
          <span className="metric-label">CC Errors:</span>
          <span
            className={`metric-value ${metrics.continuityErrors > 0 ? "status-warn" : "status-good"}`}
          >
            {metrics.continuityErrors}
          </span>
        </div>
        {detailed && (
          <>
            <div className="metric-item">
              <span className="metric-label">TEI Errors:</span>
              <span className="metric-value">{metrics.teiErrors}</span>
            </div>
            <div className="metric-item">
              <span className="metric-label">Sync Errors:</span>
              <span className="metric-value">{metrics.syncErrors}</span>
            </div>
            <div className="metric-item">
              <span className="metric-label">PAT Updates:</span>
              <span className="metric-value">{metrics.patUpdates}</span>
            </div>
            <div className="metric-item">
              <span className="metric-label">PMT Updates:</span>
              <span className="metric-value">{metrics.pmtUpdates}</span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/**
 * Decoder metrics display
 */
function DecoderMetricsDisplay({
  title,
  metrics,
  detailed,
}: {
  title: string;
  metrics: DecoderMetrics | null;
  detailed: boolean;
}): React.JSX.Element {
  if (!metrics) {
    return (
      <div className="metrics-section">
        <h4>{title}</h4>
        <div className="metrics-grid">
          <div className="metric-item">
            <span className="metric-label">Status:</span>
            <span className="metric-value status-unknown">No Data</span>
          </div>
        </div>
      </div>
    );
  }

  const dropRate =
    metrics.processedCount > 0
      ? (metrics.droppedCount / metrics.processedCount) * 100
      : 0;

  return (
    <div className="metrics-section">
      <h4>{title}</h4>
      <div className="metrics-grid">
        <div className="metric-item">
          <span className="metric-label">State:</span>
          <span className="metric-value">{metrics.state}</span>
        </div>
        <div className="metric-item">
          <span className="metric-label">Processed:</span>
          <span className="metric-value">{metrics.processedCount}</span>
        </div>
        <div className="metric-item">
          <span className="metric-label">Dropped:</span>
          <span
            className={`metric-value ${metrics.droppedCount > 0 ? "status-warn" : "status-good"}`}
          >
            {metrics.droppedCount}
          </span>
        </div>
        {detailed && (
          <>
            <div className="metric-item">
              <span className="metric-label">Drop Rate:</span>
              <span
                className={`metric-value ${getStatusClass(100 - dropRate, 99, 95)}`}
              >
                {formatMetric(dropRate, "%", 2)}
              </span>
            </div>
            <div className="metric-item">
              <span className="metric-label">Errors:</span>
              <span
                className={`metric-value ${metrics.errorCount > 0 ? "status-warn" : "status-good"}`}
              >
                {metrics.errorCount}
              </span>
            </div>
            {metrics.bufferHealth !== undefined && (
              <div className="metric-item">
                <span className="metric-label">Buffer Health:</span>
                <span
                  className={`metric-value ${getStatusClass(metrics.bufferHealth, 0.7, 0.4)}`}
                >
                  {formatMetric(metrics.bufferHealth * 100, "%", 0)}
                </span>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

/**
 * Recent events display
 */
function RecentEventsDisplay({
  events,
}: {
  events: DiagnosticEvent[];
}): React.JSX.Element {
  const recentEvents = events.slice(-5).reverse();

  if (recentEvents.length === 0) {
    return (
      <div className="events-section">
        <h4>Recent Events</h4>
        <div className="events-list">
          <div className="event-item status-info">No events recorded</div>
        </div>
      </div>
    );
  }

  return (
    <div className="events-section">
      <h4>Recent Events</h4>
      <div className="events-list">
        {recentEvents.map((event) => (
          <div
            key={event.id}
            className={`event-item status-${event.severity === "error" ? "bad" : event.severity === "warning" ? "warn" : "info"}`}
          >
            <span className="event-source">[{event.source}]</span>
            <span className="event-message">{event.message}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * DiagnosticsOverlay component
 *
 * Note: This component subscribes to all diagnostics state via useDiagnostics().
 * While this causes re-renders on every metrics update, the component is typically
 * only mounted when actively needed, and the metrics themselves are displayed values
 * that should update frequently to show real-time signal quality.
 */
export function DiagnosticsOverlay({
  className = "",
  detailed = false,
}: DiagnosticsOverlayProps): React.JSX.Element | null {
  const diagnostics = useDiagnostics();
  const { primaryDevice: device } = useDevice();
  const {
    events,
    demodulatorMetrics,
    tsParserMetrics,
    videoDecoderMetrics,
    audioDecoderMetrics,
    captionDecoderMetrics,
    overlayVisible,
    setOverlayVisible,
  } = diagnostics;

  const [minimized, setMinimized] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [position, setPosition] = useState({ x: 20, y: 20 });
  const [dragging, setDragging] = useState(false);
  const dragStartRef = useRef<{ x: number; y: number } | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  const handleResetDevice = useCallback(async () => {
    if (!device || resetting) {
      return;
    }

    try {
      setResetting(true);
      console.info("DiagnosticsOverlay: Triggering device reset");

      // Use the new resetAndReopen method if available
      if (
        typeof (device as unknown as { resetAndReopen?: () => Promise<void> })
          .resetAndReopen === "function"
      ) {
        await (
          device as unknown as { resetAndReopen: () => Promise<void> }
        ).resetAndReopen();
      } else {
        // Fallback: close and reopen
        await device.close();
        await new Promise((resolve) => setTimeout(resolve, 500));
        await device.open();
      }

      console.info("DiagnosticsOverlay: Device reset complete");
    } catch (err) {
      console.error("DiagnosticsOverlay: Device reset failed", err);
    } finally {
      setResetting(false);
    }
  }, [device, resetting]);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent<HTMLDivElement>): void => {
      if ((e.target as HTMLElement).closest(".overlay-header")) {
        setDragging(true);
        dragStartRef.current = {
          x: e.clientX - position.x,
          y: e.clientY - position.y,
        };
      }
    },
    [position],
  );

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (dragging && dragStartRef.current) {
        setPosition({
          x: e.clientX - dragStartRef.current.x,
          y: e.clientY - dragStartRef.current.y,
        });
      }
    },
    [dragging],
  );

  const handleMouseUp = useCallback(() => {
    setDragging(false);
    dragStartRef.current = null;
  }, []);

  // Keyboard navigation for moving dialog
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>): void => {
      const step = e.shiftKey ? 10 : 1;
      const newPosition = { ...position };

      // Get actual overlay dimensions for boundary calculations
      const bounds = dialogRef.current?.getBoundingClientRect();
      const maxX = bounds
        ? window.innerWidth - bounds.width
        : window.innerWidth - 400;
      const maxY = bounds
        ? window.innerHeight - bounds.height
        : window.innerHeight - 100;

      switch (e.key) {
        case "ArrowLeft":
          e.preventDefault();
          newPosition.x = Math.max(0, position.x - step);
          break;
        case "ArrowRight":
          e.preventDefault();
          newPosition.x = Math.min(maxX, position.x + step);
          break;
        case "ArrowUp":
          e.preventDefault();
          newPosition.y = Math.max(0, position.y - step);
          break;
        case "ArrowDown":
          e.preventDefault();
          newPosition.y = Math.min(maxY, position.y + step);
          break;
        case "Escape":
          e.preventDefault();
          setOverlayVisible(false);
          break;
        default:
          return;
      }

      if (newPosition.x !== position.x || newPosition.y !== position.y) {
        setPosition(newPosition);
      }
    },
    // setOverlayVisible is included (it is stable from Zustand), position changes are intentional
    [position, setOverlayVisible],
  );

  useEffect(() => {
    if (dragging) {
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
      return (): void => {
        window.removeEventListener("mousemove", handleMouseMove);
        window.removeEventListener("mouseup", handleMouseUp);
      };
    }
    return undefined;
  }, [dragging, handleMouseMove, handleMouseUp]);

  // Focus management
  useEffect(() => {
    if (overlayVisible) {
      // Store previous focus
      previousFocusRef.current = document.activeElement as HTMLElement;
      // Focus the dialog
      dialogRef.current?.focus();
    } else if (previousFocusRef.current) {
      // Restore focus when closing
      previousFocusRef.current.focus();
      previousFocusRef.current = null;
    }
  }, [overlayVisible]);

  // Cleanup previousFocusRef on unmount to prevent memory leaks
  useEffect((): (() => void) => {
    return (): void => {
      previousFocusRef.current = null;
    };
  }, []);

  if (!overlayVisible) {
    return null;
  }

  return (
    /* eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions */
    <div
      ref={dialogRef}
      className={`diagnostics-overlay ${className} ${minimized ? "minimized" : ""} ${dragging ? "dragging" : ""}`}
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
      }}
      onMouseDown={handleMouseDown}
      onKeyDown={handleKeyDown}
      role="dialog"
      aria-label="Pipeline diagnostics overlay"
      tabIndex={-1}
    >
      <div className="overlay-header">
        <h3>Pipeline Diagnostics</h3>
        <div className="overlay-controls">
          <button
            className="overlay-button"
            onClick={() => setMinimized(!minimized)}
            title={minimized ? "Maximize" : "Minimize"}
            aria-label={
              minimized ? "Maximize diagnostics" : "Minimize diagnostics"
            }
          >
            {minimized ? "▢" : "−"}
          </button>
          <button
            className="overlay-button"
            onClick={() => setOverlayVisible(false)}
            title="Close (or press Escape; arrow keys move overlay)"
            aria-label="Close diagnostics"
          >
            ×
          </button>
        </div>
      </div>
      {!minimized && (
        <div className="overlay-content">
          {device && (
            <div
              className="diagnostics-actions"
              style={{
                marginBottom: "1rem",
                paddingBottom: "0.5rem",
                borderBottom: "1px solid var(--border-color, #333)",
              }}
            >
              <button
                onClick={() => void handleResetDevice()}
                disabled={resetting}
                title="Perform USB device reset to recover from persistent errors"
                style={{
                  padding: "0.5rem 1rem",
                  fontSize: "0.875rem",
                  cursor: resetting ? "not-allowed" : "pointer",
                  opacity: resetting ? 0.6 : 1,
                }}
              >
                {resetting ? "Resetting Device..." : "🔄 Reset Device"}
              </button>
            </div>
          )}
          <DemodulatorMetricsDisplay
            metrics={demodulatorMetrics}
            detailed={detailed}
          />
          <TSParserMetricsDisplay
            metrics={tsParserMetrics}
            detailed={detailed}
          />
          {videoDecoderMetrics && (
            <DecoderMetricsDisplay
              title="Video Decoder"
              metrics={videoDecoderMetrics}
              detailed={detailed}
            />
          )}
          {audioDecoderMetrics && (
            <DecoderMetricsDisplay
              title="Audio Decoder"
              metrics={audioDecoderMetrics}
              detailed={detailed}
            />
          )}
          {captionDecoderMetrics && (
            <DecoderMetricsDisplay
              title="Caption Decoder"
              metrics={captionDecoderMetrics}
              detailed={detailed}
            />
          )}
          <RecentEventsDisplay events={events} />
        </div>
      )}
    </div>
  );
}
