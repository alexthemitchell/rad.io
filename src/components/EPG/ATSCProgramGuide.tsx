/**
 * ATSC Program Guide Component
 *
 * Main Electronic Program Guide (EPG) component that displays program
 * information extracted from ATSC PSIP tables in a user-friendly grid format.
 *
 * Features:
 * - Channel grid with time slots
 * - Program descriptions from EIT
 * - Extended text from ETT
 * - Genre/rating information
 * - Schedule up to 16 days ahead
 * - Search and filter capabilities
 * - Reminder/recording scheduler UI
 */

import React, { useState, useCallback } from "react";
import { useEPG } from "../../hooks/useEPG";
import { InfoBanner } from "../InfoBanner";
import { ProgramDetailModal } from "./ProgramDetailModal";
import { ProgramGrid } from "./ProgramGrid";
import type { EPGProgram } from "../../utils/epgStorage";

export interface ATSCProgramGuideProps {
  onTuneToChannel?: (channelNumber: string, startTime: Date) => void;
  onSetReminder?: (program: EPGProgram) => void;
  onScheduleRecording?: (program: EPGProgram) => void;
}

/**
 * ATSC Program Guide Component
 */
export function ATSCProgramGuide({
  onTuneToChannel,
  onSetReminder,
  onScheduleRecording,
}: ATSCProgramGuideProps): React.JSX.Element {
  const epg = useEPG();
  const [selectedProgram, setSelectedProgram] = useState<EPGProgram | null>(
    null,
  );
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [viewMode, setViewMode] = useState<"grid" | "search">("grid");

  const handleProgramClick = useCallback((program: EPGProgram) => {
    setSelectedProgram(program);
    setIsModalOpen(true);
  }, []);

  const handleCloseModal = useCallback(() => {
    setIsModalOpen(false);
    setSelectedProgram(null);
  }, []);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    epg.setSearchQuery(e.target.value);
    if (e.target.value.trim()) {
      setViewMode("search");
    } else if (!epg.selectedGenre) {
      setViewMode("grid");
    }
  };

  const handleGenreChange = (e: React.ChangeEvent<HTMLSelectElement>): void => {
    const genre = e.target.value || null;
    epg.setSelectedGenre(genre);
    if (genre) {
      setViewMode("search");
    } else if (!epg.searchQuery) {
      setViewMode("grid");
    }
  };

  const handleClearFilters = (): void => {
    epg.setSearchQuery("");
    epg.setSelectedGenre(null);
    setViewMode("grid");
  };

  return (
    <div className="atsc-program-guide">
      <div className="epg-header">
        <h2>Program Guide</h2>
        <div className="epg-header-actions">
          <button
            className="btn btn-secondary"
            onClick={epg.refreshEPG}
            title="Refresh EPG data"
          >
            Refresh
          </button>
          <button
            className="btn btn-secondary"
            onClick={epg.clearEPG}
            title="Clear all EPG data"
          >
            Clear
          </button>
        </div>
      </div>

      <div className="epg-search-bar">
        <div className="search-input-group">
          <input
            type="search"
            className="search-input"
            placeholder="Search programs..."
            value={epg.searchQuery}
            onChange={handleSearchChange}
            aria-label="Search programs"
          />
          {epg.searchQuery && (
            <button
              className="search-clear"
              onClick={() => epg.setSearchQuery("")}
              aria-label="Clear search"
              title="Clear search"
            >
              <span aria-hidden="true">✕</span>
            </button>
          )}
        </div>

        <div className="genre-filter-group">
          <select
            className="genre-filter"
            value={epg.selectedGenre ?? ""}
            onChange={handleGenreChange}
            aria-label="Filter by genre"
          >
            <option value="">All Genres</option>
            {epg.allGenres.map((genre) => (
              <option key={genre} value={genre}>
                {genre}
              </option>
            ))}
          </select>
        </div>

        {(epg.searchQuery || epg.selectedGenre) && (
          <button
            className="btn btn-secondary"
            onClick={handleClearFilters}
            title="Clear all filters"
          >
            Clear Filters
          </button>
        )}
      </div>

      {epg.channels.length === 0 && (
        <InfoBanner
          variant="info"
          title="📺 Electronic Program Guide (EPG)"
          style={{ margin: "16px 0" }}
        >
          <p style={{ marginBottom: "8px" }}>
            The EPG displays TV schedules extracted from ATSC broadcast signals
            (PSIP tables).
          </p>
          <p style={{ marginBottom: "8px" }}>
            <strong>To view program information:</strong>
          </p>
          <ol style={{ marginLeft: "20px", marginBottom: "8px" }}>
            <li>Scan for channels first (Scanner page, press 2)</li>
            <li>Tune to a channel (ATSC Player, press 6)</li>
            <li>
              Wait 30-60 seconds for EPG data to be received from the broadcast
            </li>
            <li>Return here to view the complete program guide</li>
          </ol>
          <p style={{ marginBottom: 0, fontSize: "14px" }}>
            📖{" "}
            <a
              href="https://github.com/alexthemitchell/rad.io/blob/main/docs/tutorials/atsc-golden-path.md#step-4-view-electronic-program-guide-epg"
              target="_blank"
              rel="noopener noreferrer"
              style={{
                color: "var(--rad-info-fg)",
                textDecoration: "underline",
              }}
            >
              Learn more about EPG
            </a>
          </p>
        </InfoBanner>
      )}

      {viewMode === "grid" ? (
        <ProgramGrid
          channels={epg.channels}
          onProgramClick={handleProgramClick}
        />
      ) : (
        <div className="epg-search-results">
          <h3>Search Results ({epg.searchResults.length})</h3>
          {epg.searchResults.length === 0 ? (
            <div className="epg-no-results">
              <p>No programs found matching your criteria</p>
            </div>
          ) : (
            <div className="epg-results-list">
              {epg.searchResults.map((program) => (
                <div
                  key={`${program.channelSourceId}-${program.eventId}`}
                  className="epg-result-item"
                  onClick={() => handleProgramClick(program)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      handleProgramClick(program);
                    }
                  }}
                  role="button"
                  tabIndex={0}
                >
                  <div className="result-item-header">
                    <h4 className="result-item-title">{program.title}</h4>
                    <span className="result-item-channel">
                      Ch {program.channelNumber}
                    </span>
                  </div>
                  <div className="result-item-time">
                    {program.startTime.toLocaleString("en-US", {
                      weekday: "short",
                      month: "short",
                      day: "numeric",
                      hour: "numeric",
                      minute: "2-digit",
                      hour12: true,
                    })}
                  </div>
                  {program.description && (
                    <p className="result-item-description">
                      {program.description.substring(0, 150)}
                      {program.description.length > 150 ? "..." : ""}
                    </p>
                  )}
                  {program.genres.length > 0 && (
                    <div className="result-item-genres">
                      {program.genres.map((genre) => (
                        <span key={genre} className="genre-tag">
                          {genre}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <ProgramDetailModal
        program={selectedProgram}
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        onTuneToChannel={onTuneToChannel}
        onSetReminder={onSetReminder}
        onScheduleRecording={onScheduleRecording}
      />

      <style>{`
        .atsc-program-guide {
          display: flex;
          flex-direction: column;
          height: 100%;
          background: #111827;
          color: #f9fafb;
        }

        .epg-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 1rem;
          border-bottom: 1px solid #374151;
        }

        .epg-header h2 {
          margin: 0;
          font-size: 1.5rem;
          color: #f9fafb;
        }

        .epg-header-actions {
          display: flex;
          gap: 0.5rem;
        }

        .epg-search-bar {
          display: flex;
          gap: 1rem;
          padding: 1rem;
          background: #1f2937;
          border-bottom: 1px solid #374151;
        }

        .search-input-group {
          position: relative;
          flex: 1;
          max-width: 400px;
        }

        .search-input {
          width: 100%;
          padding: 0.5rem 2rem 0.5rem 0.75rem;
          background: #111827;
          color: #f9fafb;
          border: 1px solid #374151;
          border-radius: 0.375rem;
          font-size: 0.875rem;
        }

        .search-input:focus {
          outline: none;
          border-color: #3b82f6;
        }

        .search-clear {
          position: absolute;
          right: 0.5rem;
          top: 50%;
          transform: translateY(-50%);
          background: none;
          border: none;
          color: #9ca3af;
          cursor: pointer;
          padding: 0.25rem;
          font-size: 1rem;
        }

        .search-clear:hover {
          color: #f9fafb;
        }

        .genre-filter-group {
          min-width: 150px;
        }

        .genre-filter {
          width: 100%;
          padding: 0.5rem;
          background: #111827;
          color: #f9fafb;
          border: 1px solid #374151;
          border-radius: 0.375rem;
          font-size: 0.875rem;
        }

        .genre-filter:focus {
          outline: none;
          border-color: #3b82f6;
        }

        .epg-grid-container {
          flex: 1;
          overflow: hidden;
          display: flex;
          flex-direction: column;
        }

        .epg-grid-controls {
          display: flex;
          justify-content: center;
          gap: 0.5rem;
          padding: 1rem;
          background: #1f2937;
          border-bottom: 1px solid #374151;
        }

        .epg-grid {
          flex: 1;
          overflow: auto;
          position: relative;
        }

        .epg-time-header {
          position: sticky;
          top: 0;
          z-index: 10;
          background: #1f2937;
          border-bottom: 2px solid #374151;
          display: flex;
        }

        .epg-channel-header-spacer {
          width: 120px;
          min-width: 120px;
          background: #1f2937;
          border-right: 1px solid #374151;
        }

        .epg-time-slots {
          display: grid;
          flex: 1;
          min-width: 1200px;
        }

        .epg-time-slot {
          padding: 0.75rem 0.5rem;
          text-align: center;
          font-size: 0.75rem;
          font-weight: 600;
          color: #9ca3af;
          border-right: 1px solid #374151;
        }

        .epg-channels-container {
          position: relative;
        }

        .epg-channel-row {
          display: flex;
          border-bottom: 1px solid #374151;
          min-height: 80px;
        }

        .epg-channel-header {
          width: 120px;
          min-width: 120px;
          padding: 0.75rem;
          background: #1f2937;
          border-right: 1px solid #374151;
          position: sticky;
          left: 0;
          z-index: 5;
        }

        .channel-number {
          font-size: 1rem;
          font-weight: 700;
          color: #60a5fa;
          margin-bottom: 0.25rem;
        }

        .channel-name {
          font-size: 0.75rem;
          color: #9ca3af;
        }

        .epg-channel-programs {
          flex: 1;
          display: grid;
          grid-auto-flow: column;
          grid-auto-columns: 1fr;
          min-width: 1200px;
          position: relative;
        }

        .epg-no-programs {
          padding: 2rem;
          text-align: center;
          color: #6b7280;
          font-size: 0.875rem;
        }

        .epg-program-cell {
          padding: 0.5rem;
          background: #1e40af;
          border: 1px solid #1e3a8a;
          border-radius: 0.25rem;
          margin: 0.25rem;
          cursor: pointer;
          transition: all 0.2s;
          overflow: hidden;
        }

        .epg-program-cell:hover {
          background: #1d4ed8;
          border-color: #3b82f6;
          z-index: 2;
        }

        .epg-program-cell:focus {
          outline: 2px solid #3b82f6;
          outline-offset: 2px;
        }

        .epg-program-cell.airing {
          background: #059669;
          border-color: #047857;
        }

        .epg-program-cell.airing:hover {
          background: #10b981;
        }

        .program-cell-content {
          display: flex;
          flex-direction: column;
          gap: 0.25rem;
          height: 100%;
        }

        .program-cell-time {
          font-size: 0.625rem;
          color: #93c5fd;
          font-weight: 600;
        }

        .program-cell-title {
          font-size: 0.75rem;
          font-weight: 500;
          color: #f9fafb;
          overflow: hidden;
          text-overflow: ellipsis;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
        }

        .program-cell-hd {
          display: inline-block;
          padding: 0.125rem 0.25rem;
          background: #fbbf24;
          color: #000;
          font-size: 0.625rem;
          font-weight: 700;
          border-radius: 0.125rem;
          align-self: flex-start;
        }

        .program-cell-live-indicator {
          position: absolute;
          top: 0.25rem;
          right: 0.25rem;
          color: #ef4444;
          font-size: 0.75rem;
          animation: pulse 2s infinite;
        }

        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }

        .epg-current-time-marker {
          position: absolute;
          top: 0;
          bottom: 0;
          width: 2px;
          background: #ef4444;
          z-index: 8;
          pointer-events: none;
        }

        .epg-current-time-marker::before {
          content: '';
          position: absolute;
          top: 0;
          left: -4px;
          width: 10px;
          height: 10px;
          background: #ef4444;
          border-radius: 50%;
        }

        .epg-no-data {
          padding: 3rem;
          text-align: center;
        }

        .epg-no-data p {
          margin: 0.5rem 0;
          color: #9ca3af;
        }

        .epg-no-data-hint {
          font-size: 0.875rem;
          color: #6b7280;
        }

        .epg-search-results {
          flex: 1;
          overflow: auto;
          padding: 1rem;
        }

        .epg-search-results h3 {
          margin: 0 0 1rem 0;
          font-size: 1.125rem;
          color: #f9fafb;
        }

        .epg-no-results {
          padding: 3rem;
          text-align: center;
          color: #9ca3af;
        }

        .epg-results-list {
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
        }

        .epg-result-item {
          padding: 1rem;
          background: #1f2937;
          border: 1px solid #374151;
          border-radius: 0.375rem;
          cursor: pointer;
          transition: all 0.2s;
        }

        .epg-result-item:hover {
          background: #374151;
          border-color: #3b82f6;
        }

        .epg-result-item:focus {
          outline: 2px solid #3b82f6;
          outline-offset: 2px;
        }

        .result-item-header {
          display: flex;
          justify-content: space-between;
          align-items: start;
          margin-bottom: 0.5rem;
        }

        .result-item-title {
          margin: 0;
          font-size: 1rem;
          font-weight: 600;
          color: #f9fafb;
        }

        .result-item-channel {
          padding: 0.25rem 0.5rem;
          background: #1e40af;
          color: #93c5fd;
          font-size: 0.75rem;
          font-weight: 600;
          border-radius: 0.25rem;
        }

        .result-item-time {
          font-size: 0.875rem;
          color: #9ca3af;
          margin-bottom: 0.5rem;
        }

        .result-item-description {
          margin: 0.5rem 0;
          font-size: 0.875rem;
          color: #d1d5db;
          line-height: 1.5;
        }

        .result-item-genres {
          display: flex;
          gap: 0.5rem;
          flex-wrap: wrap;
          margin-top: 0.5rem;
        }

        .genre-tag {
          padding: 0.25rem 0.5rem;
          background: #374151;
          color: #9ca3af;
          font-size: 0.75rem;
          border-radius: 0.25rem;
        }

        .program-modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.75);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
          padding: 1rem;
        }

        .program-modal {
          background: #1f2937;
          border-radius: 0.5rem;
          max-width: 600px;
          width: 100%;
          max-height: 90vh;
          overflow: hidden;
          display: flex;
          flex-direction: column;
          box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.3);
        }

        .program-modal-header {
          display: flex;
          justify-content: space-between;
          align-items: start;
          padding: 1.5rem;
          border-bottom: 1px solid #374151;
        }

        .program-modal-title {
          margin: 0;
          font-size: 1.5rem;
          color: #f9fafb;
          flex: 1;
          padding-right: 1rem;
        }

        .program-modal-close {
          background: none;
          border: none;
          color: #9ca3af;
          font-size: 1.5rem;
          cursor: pointer;
          padding: 0.25rem;
          line-height: 1;
        }

        .program-modal-close:hover {
          color: #f9fafb;
        }

        .program-modal-body {
          flex: 1;
          overflow-y: auto;
          padding: 1.5rem;
        }

        .program-modal-meta {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 1rem;
          margin-bottom: 1.5rem;
        }

        .program-meta-item {
          display: flex;
          gap: 0.5rem;
          align-items: center;
        }

        .meta-label {
          font-size: 0.875rem;
          color: #9ca3af;
          font-weight: 500;
        }

        .meta-value {
          font-size: 0.875rem;
          color: #f9fafb;
        }

        .hd-badge {
          padding: 0.25rem 0.5rem;
          background: #fbbf24;
          color: #000;
          font-size: 0.75rem;
          font-weight: 700;
          border-radius: 0.25rem;
        }

        .status-badge {
          padding: 0.25rem 0.5rem;
          font-size: 0.75rem;
          font-weight: 600;
          border-radius: 0.25rem;
        }

        .status-badge.live {
          background: #10b981;
          color: #000;
        }

        .status-badge.future {
          background: #3b82f6;
          color: #fff;
        }

        .status-badge.past {
          background: #6b7280;
          color: #fff;
        }

        .program-modal-description {
          margin-top: 1.5rem;
        }

        .program-modal-description h3 {
          margin: 0 0 0.75rem 0;
          font-size: 1rem;
          color: #f9fafb;
        }

        .program-modal-description p {
          margin: 0;
          color: #d1d5db;
          font-size: 0.875rem;
          line-height: 1.6;
        }

        .program-modal-actions {
          display: flex;
          gap: 0.75rem;
          padding: 1.5rem;
          border-top: 1px solid #374151;
        }

        @media (max-width: 768px) {
          .epg-search-bar {
            flex-direction: column;
          }

          .search-input-group {
            max-width: none;
          }

          .epg-channel-header {
            width: 80px;
            min-width: 80px;
          }

          .epg-channel-header-spacer {
            width: 80px;
            min-width: 80px;
          }

          .channel-number {
            font-size: 0.875rem;
          }

          .channel-name {
            font-size: 0.625rem;
          }
        }
      `}</style>
    </div>
  );
}
