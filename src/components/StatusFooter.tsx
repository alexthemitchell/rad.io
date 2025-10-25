import React from "react";

/**
 * StatusFooter component - System metrics display
 *
 * According to ADR-0018, displays (optional on desktop):
 * - FPS (frames per second, target 60)
 * - GPU mode (WebGL2/WebGPU)
 * - Audio state (playing/stopped)
 * - Storage usage (recording space)
 *
 * TODO: Integrate with performance monitoring
 * TODO: Add FPS counter
 * TODO: Add GPU mode detection
 * TODO: Add audio state indicator
 * TODO: Add storage usage display
 * TODO: Make collapsible on mobile
 */
function StatusFooter(): React.JSX.Element {
  return (
    <footer
      className="status-footer"
      role="contentinfo"
      aria-label="System status"
    >
      {/* TODO: FPS display */}
      <span className="status-item">
        <span className="status-label">FPS:</span>
        <span className="status-value">--</span>
      </span>

      {/* TODO: GPU mode display */}
      <span className="status-item">
        <span className="status-label">GPU:</span>
        <span className="status-value">--</span>
      </span>

      {/* TODO: Audio state display */}
      <span className="status-item">
        <span className="status-label">Audio:</span>
        <span className="status-value">--</span>
      </span>

      {/* TODO: Storage usage display */}
      <span className="status-item">
        <span className="status-label">Storage:</span>
        <span className="status-value">--</span>
      </span>
    </footer>
  );
}

export default StatusFooter;
