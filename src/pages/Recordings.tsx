import React from "react";
import { useStorageQuota } from "../hooks/useStorageQuota";

/**
 * Recordings page for IQ/audio recording library
 *
 * Purpose: Library for IQ/audio recordings with metadata and export
 * Dependencies: ADR-0005 (Storage Strategy), ADR-0010 (Offline-First)
 *
 * Features to implement:
 * - List/grid view with filters and tags
 * - Playback/preview functionality
 * - SigMF export
 * - Storage quota management
 * - Search and filter recordings
 *
 * Success criteria:
 * - Handles 20GB+ with quota management
 * - Supports segmented long captures (per PRD)
 *
 * TODO: Implement recording list/grid with metadata
 * TODO: Add playback controls and preview
 * TODO: Implement SigMF export functionality
 * TODO: Add search, filter, and tagging system
 * TODO: Integrate with IndexedDB storage (ADR-0005)
 */

/**
 * Format bytes to human-readable string (KB, MB, GB)
 */
function formatBytes(bytes: number): string {
  if (bytes === 0) {
    return "0 B";
  }
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.max(0, Math.floor(Math.log(bytes) / Math.log(k)));
  return `${(bytes / k ** i).toFixed(2)} ${sizes[i]}`;
}

/**
 * Get CSS class for storage progress bar based on percentage used
 * Aligned with PRD requirement: warning at >=85%
 */
function getStorageClass(percentUsed: number): string {
  if (percentUsed >= 85) {
    return "storage-critical";
  }
  if (percentUsed >= 70) {
    return "storage-warning";
  }
  return "storage-ok";
}

function Recordings(): React.JSX.Element {
  const storageQuota = useStorageQuota();
  return (
    <main
      className="page-container"
      role="main"
      aria-labelledby="recordings-heading"
    >
      <h2 id="recordings-heading">Recordings Library</h2>

      <section aria-label="Recording List Controls">
        <div>
          {/* TODO: View toggle (list/grid), search, filter controls */}
          <p>Search and filter controls coming soon</p>
        </div>
      </section>

      <section aria-label="Recordings List">
        <h3>Your Recordings</h3>
        {/* TODO: Recording list/grid with thumbnails, metadata, and actions */}
        <p>No recordings yet. Start recording from the Monitor page.</p>
      </section>

      <aside aria-label="Storage Information">
        <h3>Storage</h3>
        {!storageQuota.supported ? (
          <p>Storage quota information not available in this browser.</p>
        ) : (
          <div className="storage-info">
            {storageQuota.percentUsed >= 85 && (
              <div className="storage-warning" role="alert">
                <strong>Warning:</strong> Storage is{" "}
                {storageQuota.percentUsed.toFixed(1)}% full. Consider deleting
                old recordings to free up space.
              </div>
            )}

            <div className="storage-stats">
              <div className="stat-item">
                <span className="stat-label">Used:</span>
                <span className="stat-value">
                  {formatBytes(storageQuota.usage)}
                </span>
              </div>
              <div className="stat-item">
                <span className="stat-label">Available:</span>
                <span className="stat-value">
                  {formatBytes(storageQuota.available)}
                </span>
              </div>
              <div className="stat-item">
                <span className="stat-label">Total:</span>
                <span className="stat-value">
                  {formatBytes(storageQuota.quota)}
                </span>
              </div>
            </div>

            <div className="storage-progress-container">
              <div
                className="storage-progress-bar"
                role="progressbar"
                aria-valuenow={Math.min(
                  100,
                  Math.round(storageQuota.percentUsed),
                )}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label="Storage usage percentage"
              >
                <div
                  className={`storage-progress-fill ${getStorageClass(storageQuota.percentUsed)}`}
                  style={{
                    width: `${Math.min(storageQuota.percentUsed, 100)}%`,
                  }}
                />
              </div>
              <div className="storage-progress-text">
                {storageQuota.percentUsed.toFixed(1)}% used
              </div>
            </div>
          </div>
        )}
      </aside>

      <section aria-label="Recording Playback">
        {/* TODO: Playback controls when a recording is selected */}
        {/* TODO: Option to open in Analysis or Decode */}
      </section>

      <style>{`
        .storage-info {
          display: flex;
          flex-direction: column;
          gap: 16px;
          padding: 16px;
          background: var(--panel-background, #1a1a1a);
          border: 1px solid var(--border-color, #333);
          border-radius: 8px;
        }

        .storage-warning {
          padding: 12px;
          background: rgb(244 67 54 / 10%);
          border: 1px solid var(--accent-red, #f44336);
          border-radius: 4px;
          color: var(--accent-red, #f44336);
          font-size: 14px;
        }

        .storage-warning strong {
          font-weight: 600;
        }

        .storage-stats {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
          gap: 12px;
        }

        .stat-item {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .stat-label {
          color: var(--text-secondary, #888);
          font-size: 13px;
          font-weight: 500;
        }

        .stat-value {
          color: var(--text-primary, #fff);
          font-size: 16px;
          font-weight: 600;
          font-family: "Courier New", monospace;
        }

        .storage-progress-container {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .storage-progress-bar {
          height: 12px;
          background: var(--progress-background, #252525);
          border-radius: 6px;
          overflow: hidden;
          border: 1px solid var(--border-color, #333);
        }

        .storage-progress-fill {
          height: 100%;
          transition: width 0.3s ease;
        }

        .storage-progress-fill.storage-ok {
          background: linear-gradient(
            90deg,
            var(--accent-cyan, #00bcd4),
            var(--accent-blue, #2196f3)
          );
        }

        .storage-progress-fill.storage-warning {
          background: linear-gradient(
            90deg,
            var(--accent-orange, #ff9800),
            var(--accent-amber, #ffc107)
          );
        }

        .storage-progress-fill.storage-critical {
          background: linear-gradient(
            90deg,
            var(--accent-red, #f44336),
            var(--accent-red-hover, #e53935)
          );
        }

        .storage-progress-text {
          text-align: center;
          font-size: 14px;
          font-weight: 600;
          color: var(--text-primary, #fff);
          font-family: "Courier New", monospace;
        }
      `}</style>
    </main>
  );
}

export default Recordings;
