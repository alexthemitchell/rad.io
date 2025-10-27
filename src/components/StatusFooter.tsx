import { useState, useEffect } from "react";
import { renderTierManager } from "../lib/render/RenderTierManager";
import { RenderTier } from "../types/rendering";
import { performanceMonitor } from "../utils/performanceMonitor";

/**
 * DEPRECATED: This component has been replaced by StatusBar and is kept only for
 * historical reference. It is not exported from the components barrel and should not
 * be imported anywhere. Please use `StatusBar` instead for system metrics.
 *
 * StatusFooter component - System metrics display
 *
 * According to ADR-0018, displays (optional on desktop):
 * - FPS (frames per second, target 60)
 * - GPU mode (WebGL2/WebGPU)
 * - Audio state (playing/stopped)
 * - Storage usage (recording space)
 *
 * Integrates with:
 * - performanceMonitor for FPS calculation
 * - renderTierManager for GPU backend detection
 * - Future: audio playback system
 * - Future: storage API for quota
 *
 * TODO: Add audio state indicator
 * TODO: Add storage usage display
 * TODO: Make collapsible on mobile
 */
function StatusFooter(): React.JSX.Element {
  const [fps, setFps] = useState<number>(0);
  const [renderTier, setRenderTier] = useState<RenderTier>(RenderTier.Unknown);
  const [audioState] = useState<string>("Stopped");
  const [storageUsed] = useState<string>("--");

  // Update FPS every second
  useEffect(() => {
    const interval = setInterval(() => {
      setFps(performanceMonitor.getFPS());
    }, 1000);

    return (): void => {
      clearInterval(interval);
    };
  }, []);

  // Subscribe to render tier changes
  useEffect(() => {
    return renderTierManager.subscribe(setRenderTier);
  }, []);

  const formatFPS = (value: number): string => {
    if (value === 0) {
      return "--";
    }
    return `${value.toFixed(1)} FPS`;
  };

  const formatRenderTier = (tier: RenderTier): string => {
    if (tier === RenderTier.Unknown) {
      return "Software";
    }
    return tier;
  };

  const getFPSColor = (value: number): string => {
    if (value === 0) {
      return "";
    }
    if (value >= 55) {
      return "status-good";
    }
    if (value >= 30) {
      return "status-warning";
    }
    return "status-error";
  };

  return (
    <footer
      className="status-footer"
      role="contentinfo"
      aria-label="System status"
    >
      {/* FPS display */}
      <span className="status-item">
        <span className="status-label">FPS:</span>
        <span className={`status-value ${getFPSColor(fps)}`}>
          {formatFPS(fps)}
        </span>
      </span>

      {/* GPU mode display */}
      <span className="status-item">
        <span className="status-label">GPU:</span>
        <span className="status-value">{formatRenderTier(renderTier)}</span>
      </span>

      {/* Audio state display */}
      <span className="status-item">
        <span className="status-label">Audio:</span>
        <span className="status-value">{audioState}</span>
      </span>

      {/* Storage usage display */}
      <span className="status-item">
        <span className="status-label">Storage:</span>
        <span className="status-value">{storageUsed}</span>
      </span>
    </footer>
  );
}

export default StatusFooter;
