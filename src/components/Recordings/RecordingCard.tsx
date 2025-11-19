import React from "react";
import type { RecordingMeta } from "../../lib/recording/types";

export interface RecordingCardProps {
  recording: RecordingMeta;
  onRecordingSelect: (id: string) => void;
  onPlay: (id: string) => void;
  onDelete: (id: string) => void;
  onExport: (id: string) => void;
  onEditTags?: (id: string) => void;
}

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
 * Format frequency to human-readable string (kHz, MHz, GHz)
 */
function formatFrequency(hz: number): string {
  if (hz >= 1e9) {
    return `${(hz / 1e9).toFixed(3)} GHz`;
  }
  if (hz >= 1e6) {
    return `${(hz / 1e6).toFixed(3)} MHz`;
  }
  if (hz >= 1e3) {
    return `${(hz / 1e3).toFixed(3)} kHz`;
  }
  return `${hz.toFixed(0)} Hz`;
}

/**
 * Format duration to human-readable string (mm:ss or hh:mm:ss)
 */
function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  }
  return `${minutes}:${secs.toString().padStart(2, "0")}`;
}

/**
 * Format timestamp to human-readable date/time string
 */
function formatTimestamp(isoString: string): string {
  const date = new Date(isoString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  // If within last 24 hours, show relative time
  if (diffDays === 0) {
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    if (diffHours === 0) {
      const diffMinutes = Math.floor(diffMs / (1000 * 60));
      if (diffMinutes === 0) {
        return "Just now";
      }
      return `${diffMinutes}m ago`;
    }
    return `${diffHours}h ago`;
  }

  // Otherwise show formatted date
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: date.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
    hour: "numeric",
    minute: "2-digit",
  });
}

/**
 * RecordingCard component - displays a single recording with metadata and actions
 */
function RecordingCard({
  recording,
  onRecordingSelect,
  onPlay,
  onDelete,
  onExport,
  onEditTags,
}: RecordingCardProps): React.JSX.Element {
  const handlePlay = (): void => {
    onRecordingSelect(recording.id);
    onPlay(recording.id);
  };

  const handleDelete = (): void => {
    onDelete(recording.id);
  };

  const handleExport = (): void => {
    onExport(recording.id);
  };

  const handleEditTags = (): void => {
    if (onEditTags) {
      onEditTags(recording.id);
    }
  };

  const cardId = `recording-card-${recording.id}`;
  const titleId = `${cardId}-title`;

  return (
    <article
      className="recording-card"
      aria-labelledby={titleId}
      data-recording-id={recording.id}
    >
      <div className="recording-card-header">
        <h3 id={titleId} className="recording-card-title">
          {recording.label ?? formatFrequency(recording.frequency)}
        </h3>
        <div className="recording-card-frequency">
          {formatFrequency(recording.frequency)}
        </div>
      </div>

      <div className="recording-card-metadata">
        <div className="recording-card-meta-item">
          <span className="recording-card-meta-label">Date:</span>
          <span className="recording-card-meta-value">
            {formatTimestamp(recording.timestamp)}
          </span>
        </div>
        <div className="recording-card-meta-item">
          <span className="recording-card-meta-label">Duration:</span>
          <span className="recording-card-meta-value">
            {formatDuration(recording.duration)}
          </span>
        </div>
        <div className="recording-card-meta-item">
          <span className="recording-card-meta-label">Size:</span>
          <span className="recording-card-meta-value">
            {formatBytes(recording.size)}
          </span>
        </div>
      </div>

      <div className="recording-card-actions" role="group" aria-label="Actions">
        <button
          type="button"
          className="recording-card-action"
          onClick={handlePlay}
          aria-label={`Play recording ${recording.label ?? formatFrequency(recording.frequency)}`}
          title="Play"
        >
          ▶️
        </button>
        <button
          type="button"
          className="recording-card-action"
          onClick={handleExport}
          aria-label={`Export recording ${recording.label ?? formatFrequency(recording.frequency)}`}
          title="Export"
        >
          ⬇️
        </button>
        {onEditTags && (
          <button
            type="button"
            className="recording-card-action"
            onClick={handleEditTags}
            aria-label={`Edit tags for ${recording.label ?? formatFrequency(recording.frequency)}`}
            title="Edit tags"
          >
            ✏️
          </button>
        )}
        <button
          type="button"
          className="recording-card-action recording-card-action-delete"
          onClick={handleDelete}
          aria-label={`Delete recording ${recording.label ?? formatFrequency(recording.frequency)}`}
          title="Delete"
        >
          🗑️
        </button>
      </div>

      <style>{`
        .recording-card {
          background: var(--panel-background, #1a1a1a);
          border: 1px solid var(--border-color, #333);
          border-radius: 8px;
          padding: 16px;
          display: flex;
          flex-direction: column;
          gap: 12px;
          transition: border-color 0.2s ease;
        }

        .recording-card:hover {
          border-color: var(--accent-cyan, #00bcd4);
        }

        .recording-card:focus-within {
          border-color: var(--accent-cyan, #00bcd4);
          outline: 2px solid var(--accent-cyan, #00bcd4);
          outline-offset: 2px;
        }

        .recording-card-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 8px;
        }

        .recording-card-title {
          margin: 0;
          font-size: 16px;
          font-weight: 600;
          color: var(--text-primary, #fff);
          flex: 1;
          min-width: 0;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .recording-card-frequency {
          font-size: 14px;
          font-weight: 600;
          color: var(--accent-cyan, #00bcd4);
          font-family: "Courier New", monospace;
          white-space: nowrap;
        }

        .recording-card-metadata {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .recording-card-meta-item {
          display: flex;
          justify-content: space-between;
          font-size: 13px;
        }

        .recording-card-meta-label {
          color: var(--text-secondary, #888);
          font-weight: 500;
        }

        .recording-card-meta-value {
          color: var(--text-primary, #fff);
          font-family: "Courier New", monospace;
        }

        .recording-card-actions {
          display: flex;
          gap: 8px;
          margin-top: 4px;
        }

        .recording-card-action {
          flex: 1;
          min-width: 44px;
          min-height: 44px;
          padding: 8px;
          background: var(--button-background, #252525);
          border: 1px solid var(--border-color, #333);
          border-radius: 4px;
          color: var(--text-primary, #fff);
          font-size: 16px;
          cursor: pointer;
          transition: all 0.2s ease;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .recording-card-action:hover {
          background: var(--button-hover-background, #333);
          border-color: var(--accent-cyan, #00bcd4);
        }

        .recording-card-action:focus {
          outline: 2px solid var(--accent-cyan, #00bcd4);
          outline-offset: 2px;
        }

        .recording-card-action:active {
          transform: scale(0.95);
        }

        .recording-card-action-delete:hover {
          background: rgb(244 67 54 / 10%);
          border-color: var(--accent-red, #f44336);
        }

        @media (prefers-reduced-motion: reduce) {
          .recording-card,
          .recording-card-action {
            transition-duration: 0s;
          }
          .recording-card-action:active {
            transform: none;
          }
        }
      `}</style>
    </article>
  );
}

export default RecordingCard;
