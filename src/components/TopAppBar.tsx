import React from "react";

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
 * TODO: Integrate with device state management
 * TODO: Add buffer health monitoring
 * TODO: Add connection status indicator
 * TODO: Implement quick record toggle
 * TODO: Add error notification system
 * TODO: Add accessibility announcements for status changes
 */
function TopAppBar(): React.JSX.Element {
  return (
    <div className="top-app-bar" role="banner" aria-label="Application status">
      <section aria-label="Device Status">
        {/* TODO: Connection status indicator */}
        <span className="status-item">
          <span className="status-label">Device:</span>
          <span className="status-value">Not Connected</span>
        </span>

        {/* TODO: Sample rate display */}
        <span className="status-item">
          <span className="status-label">Sample Rate:</span>
          <span className="status-value">-- MSPS</span>
        </span>

        {/* TODO: Buffer health indicator */}
        <span className="status-item">
          <span className="status-label">Buffer:</span>
          <span className="status-value">--</span>
        </span>
      </section>

      <section aria-label="Quick Actions">
        {/* TODO: Quick record button */}
        <button
          className="record-button"
          disabled
          aria-label="Start recording"
          title="Quick record toggle (Keyboard: R)"
        >
          Record
        </button>
      </section>

      <section aria-label="Global Errors">
        {/* TODO: Error notification area */}
        {/* Only visible when errors exist */}
      </section>
    </div>
  );
}

export default TopAppBar;
