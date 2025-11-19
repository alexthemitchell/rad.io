/**
 * Scanner Activity Log Component
 *
 * Displays scan activity with signal detections, frequencies, and signal metrics.
 * Shows an empty state when no scan data is available.
 */

import React from "react";

export type ScanActivity = {
  id: string;
  timestamp: string; // ISO 8601 format
  frequency: number; // MHz
  signalStrength: number; // dBm or S-units
  duration: number; // seconds
  mode: "AM" | "FM" | "SSB" | "CW" | "Digital";
};

export type ActivityLogProps = {
  activities?: ScanActivity[];
  onBookmark?: (activity: ScanActivity) => void;
  onRecord?: (activity: ScanActivity) => void;
};

/**
 * ActivityLog component displays scan results in a table format
 * with an empty state when no data is available
 */
function ActivityLog({
  activities = [],
  onBookmark,
  onRecord,
}: ActivityLogProps): React.JSX.Element {
  const formatFrequency = (freq: number): string => {
    return freq.toFixed(3);
  };

  const formatDuration = (seconds: number): string => {
    if (seconds < 60) {
      return `${seconds}s`;
    }
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}m ${remainingSeconds}s`;
  };

  const formatTimestamp = (timestamp: string): string => {
    const date = new Date(timestamp);
    return date.toLocaleString();
  };

  return (
    <div className="activity-log">
      <div className="activity-log-container">
        <table className="activity-log-table" role="table">
          <thead>
            <tr>
              <th scope="col">Timestamp</th>
              <th scope="col">Frequency (MHz)</th>
              <th scope="col">Signal Strength</th>
              <th scope="col">Duration</th>
              <th scope="col">Mode</th>
              <th scope="col">Actions</th>
            </tr>
          </thead>
          <tbody>
            {activities.length === 0 ? (
              <tr>
                <td colSpan={6} className="activity-log-empty">
                  <div className="empty-state-content">
                    <p className="empty-state-message">
                      No scan activity yet. Start a scan to see detected signals
                      here.
                    </p>
                  </div>
                </td>
              </tr>
            ) : (
              activities.map((activity) => (
                <tr key={activity.id}>
                  <td data-label="Timestamp">
                    {formatTimestamp(activity.timestamp)}
                  </td>
                  <td data-label="Frequency (MHz)" className="frequency-cell">
                    {formatFrequency(activity.frequency)}
                  </td>
                  <td
                    data-label="Signal Strength"
                    className="signal-strength-cell"
                  >
                    {activity.signalStrength > 0
                      ? `+${activity.signalStrength}`
                      : activity.signalStrength}{" "}
                    dBm
                  </td>
                  <td data-label="Duration">
                    {formatDuration(activity.duration)}
                  </td>
                  <td data-label="Mode">
                    <span className="mode-badge">{activity.mode}</span>
                  </td>
                  <td data-label="Actions" className="actions-cell">
                    <button
                      className="btn btn-icon"
                      onClick={() => onBookmark?.(activity)}
                      aria-label={`Bookmark signal at ${formatFrequency(activity.frequency)} MHz`}
                      title="Bookmark this signal"
                    >
                      ⭐
                    </button>
                    <button
                      className="btn btn-icon"
                      onClick={() => onRecord?.(activity)}
                      aria-label={`Record signal at ${formatFrequency(activity.frequency)} MHz`}
                      title="Record this signal"
                    >
                      ⏺
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default ActivityLog;
