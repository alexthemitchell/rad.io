/**
 * Transmission Log Viewer Component
 *
 * Displays historical P25 transmission logs with search, filter, and sort capabilities.
 */

import { useState, useEffect, useCallback, type ChangeEvent } from "react";
import {
  getP25TransmissionLogger,
  type TransmissionRecord,
  type TransmissionQueryOptions,
} from "../utils/p25TransmissionLog";

type SortField = "timestamp" | "talkgroupId" | "duration" | "signalQuality";
type SortDirection = "asc" | "desc";

export default function TransmissionLogViewer(): React.JSX.Element {
  const [transmissions, setTransmissions] = useState<TransmissionRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [totalCount, setTotalCount] = useState(0);

  // Filter states
  const [talkgroupFilter, setTalkgroupFilter] = useState("");
  const [sourceFilter, setSourceFilter] = useState("");
  const [minQualityFilter, setMinQualityFilter] = useState(0);
  const [dateRangeStart, setDateRangeStart] = useState("");
  const [dateRangeEnd, setDateRangeEnd] = useState("");

  // Sort states
  const [sortField, setSortField] = useState<SortField>("timestamp");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

  // Pagination
  const [currentPage, setCurrentPage] = useState(0);
  const [itemsPerPage] = useState(50);

  const loadTransmissions = useCallback(async (): Promise<void> => {
    setLoading(true);
    setError(null);

    try {
      const logger = getP25TransmissionLogger();
      await logger.init();

      const queryOptions: TransmissionQueryOptions = {
        limit: itemsPerPage,
        offset: currentPage * itemsPerPage,
      };

      if (talkgroupFilter) {
        const talkgroupId = parseInt(talkgroupFilter, 10);
        if (!isNaN(talkgroupId)) {
          queryOptions.talkgroupId = talkgroupId;
        }
      }

      if (sourceFilter) {
        const sourceId = parseInt(sourceFilter, 10);
        if (!isNaN(sourceId)) {
          queryOptions.sourceId = sourceId;
        }
      }

      if (minQualityFilter > 0) {
        queryOptions.minQuality = minQualityFilter;
      }

      if (dateRangeStart) {
        queryOptions.startTime = new Date(dateRangeStart).getTime();
      }

      if (dateRangeEnd) {
        queryOptions.endTime = new Date(dateRangeEnd).getTime();
      }

      const results = await logger.queryTransmissions(queryOptions);
      const count = await logger.getCount(queryOptions);

      // Apply client-side sorting
      const sorted = sortTransmissions(results, sortField, sortDirection);

      setTransmissions(sorted);
      setTotalCount(count);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load transmissions",
      );
    } finally {
      setLoading(false);
    }
  }, [
    talkgroupFilter,
    sourceFilter,
    minQualityFilter,
    dateRangeStart,
    dateRangeEnd,
    currentPage,
    itemsPerPage,
    sortField,
    sortDirection,
  ]);

  useEffect(() => {
    void loadTransmissions();
  }, [loadTransmissions]);

  const sortTransmissions = (
    data: TransmissionRecord[],
    field: SortField,
    direction: SortDirection,
  ): TransmissionRecord[] => {
    return [...data].sort((a, b) => {
      let aVal: number;
      let bVal: number;

      switch (field) {
        case "timestamp":
          aVal = a.timestamp;
          bVal = b.timestamp;
          break;
        case "talkgroupId":
          aVal = a.talkgroupId ?? 0;
          bVal = b.talkgroupId ?? 0;
          break;
        case "duration":
          aVal = a.duration;
          bVal = b.duration;
          break;
        case "signalQuality":
          aVal = a.signalQuality;
          bVal = b.signalQuality;
          break;
      }

      return direction === "asc" ? aVal - bVal : bVal - aVal;
    });
  };

  const handleSort = (field: SortField): void => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("desc");
    }
  };

  const handleClearFilters = (): void => {
    setTalkgroupFilter("");
    setSourceFilter("");
    setMinQualityFilter(0);
    setDateRangeStart("");
    setDateRangeEnd("");
    setCurrentPage(0);
  };

  const handleExport = (): void => {
    const csv = [
      "Timestamp,Talkgroup ID,Source ID,Duration (ms),Signal Quality,Slot,Encrypted,Error Rate",
      ...transmissions.map((t) =>
        [
          new Date(t.timestamp).toISOString(),
          t.talkgroupId ?? "",
          t.sourceId ?? "",
          t.duration,
          t.signalQuality,
          t.slot,
          t.isEncrypted ? "Yes" : "No",
          t.errorRate.toFixed(3),
        ].join(","),
      ),
    ].join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `p25-transmissions-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const formatDuration = (ms: number): string => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return minutes > 0
      ? `${minutes}m ${remainingSeconds}s`
      : `${remainingSeconds}s`;
  };

  const formatTimestamp = (timestamp: number): string => {
    const date = new Date(timestamp);
    return date.toLocaleString();
  };

  const totalPages = Math.ceil(totalCount / itemsPerPage);

  return (
    <div className="transmission-log-viewer">
      <div className="log-header">
        <h2>Transmission Log</h2>
        <div className="log-stats">
          {totalCount} transmission{totalCount !== 1 ? "s" : ""} found
        </div>
      </div>

      <div className="log-filters">
        <div className="filter-group">
          <label htmlFor="talkgroup-filter">Talkgroup ID:</label>
          <input
            id="talkgroup-filter"
            type="text"
            className="control-input"
            placeholder="Filter by talkgroup"
            value={talkgroupFilter}
            onChange={(e: ChangeEvent<HTMLInputElement>) =>
              setTalkgroupFilter(e.target.value)
            }
            aria-label="Filter by talkgroup ID"
          />
        </div>

        <div className="filter-group">
          <label htmlFor="source-filter">Source ID:</label>
          <input
            id="source-filter"
            type="text"
            className="control-input"
            placeholder="Filter by source"
            value={sourceFilter}
            onChange={(e: ChangeEvent<HTMLInputElement>) =>
              setSourceFilter(e.target.value)
            }
            aria-label="Filter by source ID"
          />
        </div>

        <div className="filter-group">
          <label htmlFor="quality-filter">Min Quality:</label>
          <input
            id="quality-filter"
            type="range"
            min="0"
            max="100"
            value={minQualityFilter}
            onChange={(e: ChangeEvent<HTMLInputElement>) =>
              setMinQualityFilter(parseInt(e.target.value))
            }
            aria-label="Minimum signal quality filter"
          />
          <span>{minQualityFilter}%</span>
        </div>

        <div className="filter-group">
          <label htmlFor="date-start">Start Date:</label>
          <input
            id="date-start"
            type="datetime-local"
            className="control-input"
            value={dateRangeStart}
            onChange={(e: ChangeEvent<HTMLInputElement>) =>
              setDateRangeStart(e.target.value)
            }
            aria-label="Start date filter"
          />
        </div>

        <div className="filter-group">
          <label htmlFor="date-end">End Date:</label>
          <input
            id="date-end"
            type="datetime-local"
            className="control-input"
            value={dateRangeEnd}
            onChange={(e: ChangeEvent<HTMLInputElement>) =>
              setDateRangeEnd(e.target.value)
            }
            aria-label="End date filter"
          />
        </div>

        <button
          className="btn btn-secondary"
          onClick={handleClearFilters}
          aria-label="Clear all filters"
        >
          Clear Filters
        </button>

        <button
          className="btn btn-primary"
          onClick={handleExport}
          disabled={transmissions.length === 0}
          aria-label="Export transmissions to CSV"
        >
          Export CSV
        </button>
      </div>

      {error && <div className="log-error">{error}</div>}

      {loading ? (
        <div className="log-loading">Loading transmissions...</div>
      ) : (
        <>
          <div className="log-table-container">
            <table className="log-table">
              <thead>
                <tr>
                  <th>
                    <button
                      className="sort-button"
                      onClick={() => handleSort("timestamp")}
                      aria-label="Sort by timestamp"
                    >
                      Timestamp{" "}
                      {sortField === "timestamp" &&
                        (sortDirection === "asc" ? "▲" : "▼")}
                    </button>
                  </th>
                  <th>
                    <button
                      className="sort-button"
                      onClick={() => handleSort("talkgroupId")}
                      aria-label="Sort by talkgroup ID"
                    >
                      Talkgroup{" "}
                      {sortField === "talkgroupId" &&
                        (sortDirection === "asc" ? "▲" : "▼")}
                    </button>
                  </th>
                  <th>Source</th>
                  <th>
                    <button
                      className="sort-button"
                      onClick={() => handleSort("duration")}
                      aria-label="Sort by duration"
                    >
                      Duration{" "}
                      {sortField === "duration" &&
                        (sortDirection === "asc" ? "▲" : "▼")}
                    </button>
                  </th>
                  <th>
                    <button
                      className="sort-button"
                      onClick={() => handleSort("signalQuality")}
                      aria-label="Sort by signal quality"
                    >
                      Quality{" "}
                      {sortField === "signalQuality" &&
                        (sortDirection === "asc" ? "▲" : "▼")}
                    </button>
                  </th>
                  <th>Slot</th>
                  <th>Encrypted</th>
                </tr>
              </thead>
              <tbody>
                {transmissions.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="log-empty">
                      No transmissions found
                    </td>
                  </tr>
                ) : (
                  transmissions.map((t) => (
                    <tr key={t.id}>
                      <td>{formatTimestamp(t.timestamp)}</td>
                      <td>{t.talkgroupId ?? "—"}</td>
                      <td>{t.sourceId ?? "—"}</td>
                      <td>{formatDuration(t.duration)}</td>
                      <td>
                        <span
                          className={`quality-badge quality-${
                            t.signalQuality >= 80
                              ? "good"
                              : t.signalQuality >= 50
                                ? "fair"
                                : "poor"
                          }`}
                        >
                          {t.signalQuality}%
                        </span>
                      </td>
                      <td>Slot {t.slot}</td>
                      <td>{t.isEncrypted ? "Yes" : "No"}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="log-pagination">
              <button
                className="btn btn-secondary"
                onClick={() => setCurrentPage(Math.max(0, currentPage - 1))}
                disabled={currentPage === 0}
                aria-label="Previous page"
              >
                Previous
              </button>
              <span className="page-info">
                Page {currentPage + 1} of {totalPages}
              </span>
              <button
                className="btn btn-secondary"
                onClick={() =>
                  setCurrentPage(Math.min(totalPages - 1, currentPage + 1))
                }
                disabled={currentPage >= totalPages - 1}
                aria-label="Next page"
              >
                Next
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
