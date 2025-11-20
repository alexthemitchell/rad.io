import React, { useState, useEffect, useRef } from "react";
import RecordingList from "../components/Recordings/RecordingList";
import { useStorageQuota } from "../hooks/useStorageQuota";
import { recordingManager } from "../lib/recording/recording-manager";
import { formatBytes } from "../utils/format";
import type { RecordingMeta } from "../lib/recording/types";

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
  const [recordings, setRecordings] = useState<RecordingMeta[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedRecordingId, setSelectedRecordingId] = useState<string | null>(
    null,
  );
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const cancelButtonRef = useRef<HTMLButtonElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  // Load recordings on mount
  useEffect(() => {
    let mounted = true;

    const loadRecordings = async (): Promise<void> => {
      try {
        await recordingManager.init();
        const recs = await recordingManager.listRecordings();
        if (mounted) {
          setRecordings(recs);
          setIsLoading(false);
          setError(null);
        }
      } catch (error) {
        console.error("Failed to load recordings:", error);
        if (mounted) {
          setIsLoading(false);
          setError(
            "Failed to load recordings. Please try refreshing the page.",
          );
        }
      }
    };

    void loadRecordings();

    return (): void => {
      mounted = false;
    };
  }, []);

  const handleRecordingSelect = (id: string): void => {
    setSelectedRecordingId(id);
  };

  const handlePlay = (id: string): void => {
    // TODO: Implement playback functionality
    // eslint-disable-next-line no-console
    console.log("Play recording:", id);
    setSelectedRecordingId(id);
  };

  const handleDelete = (id: string): void => {
    setDeleteConfirmId(id);
  };

  const handleDeleteConfirm = async (): Promise<void> => {
    if (!deleteConfirmId) {
      return;
    }

    try {
      await recordingManager.deleteRecording(deleteConfirmId);
      setRecordings(recordings.filter((rec) => rec.id !== deleteConfirmId));
      if (selectedRecordingId === deleteConfirmId) {
        setSelectedRecordingId(null);
      }
      setDeleteConfirmId(null);
      setError(null);
    } catch (error) {
      console.error("Failed to delete recording:", error);
      setError("Failed to delete recording. Please try again.");
      setDeleteConfirmId(null);
    }
  };

  const handleDeleteCancel = (): void => {
    setDeleteConfirmId(null);
  };

  // Handle Escape key for delete dialog
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent): void => {
      if (e.key === "Escape" && deleteConfirmId) {
        setDeleteConfirmId(null);
      }
    };

    document.addEventListener("keydown", handleEscape);
    return (): void => {
      document.removeEventListener("keydown", handleEscape);
    };
  }, [deleteConfirmId]);

  // Focus management for delete dialog
  useEffect(() => {
    if (deleteConfirmId) {
      // Save the currently focused element
      previousFocusRef.current = document.activeElement as HTMLElement;
      // Focus the cancel button when dialog opens
      cancelButtonRef.current?.focus();
    } else if (previousFocusRef.current) {
      // Restore focus when dialog closes
      previousFocusRef.current.focus();
      previousFocusRef.current = null;
    }
  }, [deleteConfirmId]);

  const handleExport = async (id: string): Promise<void> => {
    try {
      const recording = await recordingManager.loadRecording(id);

      // Create IQ file blob
      const buffer = new ArrayBuffer(recording.samples.length * 8);
      const view = new DataView(buffer);

      for (let i = 0; i < recording.samples.length; i++) {
        const sample = recording.samples[i];
        if (!sample) {
          continue;
        }
        const offset = i * 8;
        view.setFloat32(offset, sample.I, true);
        view.setFloat32(offset + 4, sample.Q, true);
      }

      const blob = new Blob([buffer], { type: "application/octet-stream" });
      const url = URL.createObjectURL(blob);

      // Create download link
      const a = document.createElement("a");
      a.href = url;
      a.download = `recording_${recording.metadata.frequency}_${recording.metadata.timestamp.replace(/[^0-9-]/g, "-")}.iq`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setError(null);
    } catch (error) {
      console.error("Failed to export recording:", error);
      setError("Failed to export recording. Please try again.");
    }
  };

  return (
    <main
      className="page-container"
      role="main"
      aria-labelledby="recordings-heading"
    >
      <h2 id="recordings-heading">Recordings Library</h2>

      {/* Error message */}
      {error && (
        <div className="error-banner" role="alert">
          <strong>Error:</strong> {error}
          <button
            type="button"
            className="error-dismiss"
            onClick={() => {
              setError(null);
            }}
            aria-label="Dismiss error"
          >
            ✕
          </button>
        </div>
      )}

      <section aria-label="Recordings List">
        <RecordingList
          recordings={recordings}
          onRecordingSelect={handleRecordingSelect}
          onPlay={handlePlay}
          onDelete={handleDelete}
          onExport={(id): void => {
            void handleExport(id);
          }}
          isLoading={isLoading}
        />
      </section>

      {/* Delete confirmation dialog */}
      {deleteConfirmId && (
        <div
          className="delete-confirmation-overlay"
          role="dialog"
          aria-labelledby="delete-dialog-title"
          aria-modal="true"
        >
          <div className="delete-confirmation-dialog">
            <h3 id="delete-dialog-title">Delete Recording</h3>
            <p>
              Are you sure you want to delete this recording? This action cannot
              be undone.
            </p>
            <div className="delete-confirmation-actions">
              <button
                type="button"
                ref={cancelButtonRef}
                className="delete-confirmation-button delete-confirmation-cancel"
                onClick={handleDeleteCancel}
              >
                Cancel
              </button>
              <button
                type="button"
                className="delete-confirmation-button delete-confirmation-confirm"
                onClick={(): void => {
                  void handleDeleteConfirm();
                }}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

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
        {selectedRecordingId && (
          <div className="playback-placeholder">
            <p>
              Playback controls for recording {selectedRecordingId} will appear
              here
            </p>
            <p className="playback-note">
              (Playback functionality to be implemented in future iteration)
            </p>
          </div>
        )}
      </section>

      <style>{`
        .error-banner {
          padding: 12px 16px;
          margin-bottom: 16px;
          background: rgb(244 67 54 / 10%);
          border: 1px solid var(--accent-red, #f44336);
          border-radius: 4px;
          color: var(--accent-red, #f44336);
          font-size: 14px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
        }

        .error-banner strong {
          font-weight: 600;
        }

        .error-dismiss {
          background: transparent;
          border: none;
          color: var(--accent-red, #f44336);
          font-size: 18px;
          cursor: pointer;
          padding: 4px 8px;
          min-width: 32px;
          min-height: 32px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 4px;
          transition: background 0.2s ease;
        }

        .error-dismiss:hover {
          background: rgb(244 67 54 / 20%);
        }

        .error-dismiss:focus {
          outline: 2px solid var(--accent-red, #f44336);
          outline-offset: 2px;
        }

        .playback-placeholder {
          padding: 16px;
          background: var(--panel-background, #1a1a1a);
          border: 1px solid var(--border-color, #333);
          border-radius: 8px;
          text-align: center;
          margin-top: 16px;
        }

        .playback-note {
          color: var(--text-secondary, #888);
          font-size: 13px;
          margin-top: 8px;
        }

        .delete-confirmation-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgb(0 0 0 / 70%);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
        }

        .delete-confirmation-dialog {
          background: var(--panel-background, #1a1a1a);
          border: 2px solid var(--border-color, #333);
          border-radius: 8px;
          padding: 24px;
          max-width: 400px;
          width: 90%;
        }

        .delete-confirmation-dialog h3 {
          margin: 0 0 16px;
          color: var(--text-primary, #fff);
          font-size: 18px;
        }

        .delete-confirmation-dialog p {
          margin: 0 0 24px;
          color: var(--text-primary, #fff);
          line-height: 1.5;
        }

        .delete-confirmation-actions {
          display: flex;
          gap: 12px;
          justify-content: flex-end;
        }

        .delete-confirmation-button {
          min-width: 100px;
          min-height: 44px;
          padding: 10px 20px;
          border: 1px solid var(--border-color, #333);
          border-radius: 4px;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .delete-confirmation-cancel {
          background: var(--button-background, #252525);
          color: var(--text-primary, #fff);
        }

        .delete-confirmation-cancel:hover {
          background: var(--button-hover-background, #333);
          border-color: var(--accent-cyan, #00bcd4);
        }

        .delete-confirmation-confirm {
          background: var(--accent-red, #f44336);
          color: #fff;
          border-color: var(--accent-red, #f44336);
        }

        .delete-confirmation-confirm:hover {
          background: var(--accent-red-hover, #e53935);
        }

        .delete-confirmation-button:focus {
          outline: 2px solid var(--accent-cyan, #00bcd4);
          outline-offset: 2px;
        }

        @media (prefers-reduced-motion: reduce) {
          .delete-confirmation-button {
            transition-duration: 0s;
          }
        }

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
