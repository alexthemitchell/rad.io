import React, { useState, useMemo } from "react";
import EmptyState from "../EmptyState";
import RecordingCard from "./RecordingCard";
import type { RecordingMeta } from "../../lib/recording/types";

export interface RecordingListProps {
  recordings: RecordingMeta[];
  onRecordingSelect: (id: string) => void;
  onPlay: (id: string) => void;
  onDelete: (id: string) => void;
  onExport: (id: string) => void;
  onEditTags?: (id: string) => void;
  isLoading?: boolean;
}

type SortField = "date" | "frequency" | "size" | "duration";
type SortDirection = "asc" | "desc";

/**
 * RecordingList component - displays list of recordings with search, filter, and sort
 */
function RecordingList({
  recordings,
  onRecordingSelect,
  onPlay,
  onDelete,
  onExport,
  onEditTags,
  isLoading = false,
}: RecordingListProps): React.JSX.Element {
  const [searchQuery, setSearchQuery] = useState("");
  const [sortField, setSortField] = useState<SortField>("date");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

  // Filter and sort recordings
  const filteredAndSortedRecordings = useMemo(() => {
    let result = [...recordings];

    // Filter by search query (label or frequency)
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      result = result.filter((rec) => {
        const label = rec.label?.toLowerCase() ?? "";
        const freqStr = rec.frequency.toString();
        return label.includes(query) || freqStr.includes(query);
      });
    }

    // Sort
    result.sort((a, b) => {
      let compareValue = 0;

      switch (sortField) {
        case "date":
          compareValue =
            new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime();
          break;
        case "frequency":
          compareValue = a.frequency - b.frequency;
          break;
        case "size":
          compareValue = a.size - b.size;
          break;
        case "duration":
          compareValue = a.duration - b.duration;
          break;
      }

      return sortDirection === "asc" ? compareValue : -compareValue;
    });

    return result;
  }, [recordings, searchQuery, sortField, sortDirection]);

  const handleSortChange = (field: SortField): void => {
    if (sortField === field) {
      // Toggle direction if same field
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      // Set new field with default descending
      setSortField(field);
      setSortDirection("desc");
    }
  };

  if (isLoading) {
    return (
      <div className="recording-list-loading" role="status" aria-live="polite">
        <EmptyState
          title="Loading recordings..."
          message="Please wait while we fetch your recordings"
        />
      </div>
    );
  }

  return (
    <div className="recording-list" role="region" aria-label="Recordings list">
      <div className="recording-list-controls">
        <div className="recording-list-search">
          <label htmlFor="recording-search" className="sr-only">
            Search recordings
          </label>
          <input
            id="recording-search"
            type="text"
            className="recording-list-search-input"
            placeholder="Search by label or frequency..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
            }}
          />
        </div>

        <div
          className="recording-list-sort"
          role="group"
          aria-label="Sort recordings"
        >
          <span className="recording-list-sort-label">Sort by:</span>
          <button
            type="button"
            className={`recording-list-sort-button ${sortField === "date" ? "active" : ""}`}
            onClick={() => {
              handleSortChange("date");
            }}
            aria-pressed={sortField === "date"}
          >
            Date
            {sortField === "date" && (sortDirection === "asc" ? " ↑" : " ↓")}
          </button>
          <button
            type="button"
            className={`recording-list-sort-button ${sortField === "frequency" ? "active" : ""}`}
            onClick={() => {
              handleSortChange("frequency");
            }}
            aria-pressed={sortField === "frequency"}
          >
            Frequency
            {sortField === "frequency" &&
              (sortDirection === "asc" ? " ↑" : " ↓")}
          </button>
          <button
            type="button"
            className={`recording-list-sort-button ${sortField === "size" ? "active" : ""}`}
            onClick={() => {
              handleSortChange("size");
            }}
            aria-pressed={sortField === "size"}
          >
            Size
            {sortField === "size" && (sortDirection === "asc" ? " ↑" : " ↓")}
          </button>
          <button
            type="button"
            className={`recording-list-sort-button ${sortField === "duration" ? "active" : ""}`}
            onClick={() => {
              handleSortChange("duration");
            }}
            aria-pressed={sortField === "duration"}
          >
            Duration
            {sortField === "duration" &&
              (sortDirection === "asc" ? " ↑" : " ↓")}
          </button>
        </div>

        {searchQuery && (
          <div className="recording-list-results-count" aria-live="polite">
            {filteredAndSortedRecordings.length} of {recordings.length}{" "}
            recording{recordings.length !== 1 ? "s" : ""}
          </div>
        )}
      </div>

      {filteredAndSortedRecordings.length === 0 ? (
        <EmptyState
          title={searchQuery ? "No recordings found" : "No recordings yet"}
          message={
            searchQuery
              ? "Try a different search term"
              : "Start recording from the Monitor page"
          }
        />
      ) : (
        <div
          className="recording-list-grid"
          role="list"
          aria-label="Recording cards"
        >
          {filteredAndSortedRecordings.map((recording) => (
            <div
              key={recording.id}
              role="listitem"
              className="recording-list-card-wrapper"
            >
              <RecordingCard
                recording={recording}
                onRecordingSelect={onRecordingSelect}
                onPlay={onPlay}
                onDelete={onDelete}
                onExport={onExport}
                onEditTags={onEditTags}
              />
            </div>
          ))}
        </div>
      )}

      <style>{`
        .recording-list {
          display: flex;
          flex-direction: column;
          gap: 20px;
        }

        .recording-list-controls {
          display: flex;
          flex-direction: column;
          gap: 16px;
          padding: 16px;
          background: var(--panel-background, #1a1a1a);
          border: 1px solid var(--border-color, #333);
          border-radius: 8px;
        }

        .recording-list-search {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .recording-list-search-input {
          width: 100%;
          padding: 12px 16px;
          background: var(--input-background, #252525);
          border: 1px solid var(--border-color, #333);
          border-radius: 4px;
          color: var(--text-primary, #fff);
          font-size: 14px;
          font-family: inherit;
        }

        .recording-list-search-input:focus {
          outline: 2px solid var(--accent-cyan, #00bcd4);
          outline-offset: 2px;
          border-color: var(--accent-cyan, #00bcd4);
        }

        .recording-list-search-input::placeholder {
          color: var(--text-secondary, #888);
        }

        .recording-list-sort {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          gap: 8px;
        }

        .recording-list-sort-label {
          color: var(--text-secondary, #888);
          font-size: 14px;
          font-weight: 500;
        }

        .recording-list-sort-button {
          padding: 8px 16px;
          min-height: 44px;
          background: var(--button-background, #252525);
          border: 1px solid var(--border-color, #333);
          border-radius: 4px;
          color: var(--text-primary, #fff);
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .recording-list-sort-button:hover {
          background: var(--button-hover-background, #333);
          border-color: var(--accent-cyan, #00bcd4);
        }

        .recording-list-sort-button:focus {
          outline: 2px solid var(--accent-cyan, #00bcd4);
          outline-offset: 2px;
        }

        .recording-list-sort-button.active {
          background: var(--accent-cyan, #00bcd4);
          color: var(--background-primary, #0d1117);
          border-color: var(--accent-cyan, #00bcd4);
        }

        .recording-list-sort-button.active:hover {
          background: var(--accent-cyan-hover, #00acc1);
        }

        .recording-list-results-count {
          color: var(--text-secondary, #888);
          font-size: 13px;
          padding-top: 8px;
          border-top: 1px solid var(--border-color, #333);
        }

        .recording-list-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
          gap: 16px;
        }

        .recording-list-card-wrapper {
          cursor: pointer;
        }

        .recording-list-card-wrapper:focus {
          outline: none;
        }

        .sr-only {
          position: absolute;
          width: 1px;
          height: 1px;
          padding: 0;
          margin: -1px;
          overflow: hidden;
          clip: rect(0, 0, 0, 0);
          white-space: nowrap;
          border-width: 0;
        }

        @media (max-width: 768px) {
          .recording-list-grid {
            grid-template-columns: 1fr;
          }

          .recording-list-sort {
            flex-direction: column;
            align-items: stretch;
          }

          .recording-list-sort-button {
            width: 100%;
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .recording-list-sort-button {
            transition-duration: 0s;
          }
        }
      `}</style>
    </div>
  );
}

export default RecordingList;
