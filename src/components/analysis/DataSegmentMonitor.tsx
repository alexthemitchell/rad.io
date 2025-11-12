/**
 * Data Segment Sync Monitor
 *
 * Monitors and displays ATSC data segment synchronization status,
 * showing segment sync detection, field sync, and timing alignment.
 */

import React, { type ReactElement, useMemo } from "react";

export interface DataSegmentMonitorProps {
  /** Whether segment sync is currently locked */
  syncLocked: boolean;
  /** Number of segment syncs detected */
  segmentSyncCount: number;
  /** Number of field syncs detected */
  fieldSyncCount: number;
  /** Last detected sync pattern confidence (0-1) */
  syncConfidence?: number;
  /** Number of symbols since last sync */
  symbolsSinceSync?: number;
  /** Expected symbols per segment (832 for ATSC) */
  segmentLength?: number;
  /** Whether to show detailed sync statistics */
  showDetails?: boolean;
}

/**
 * Get sync status indicator
 */
function getSyncStatus(
  syncLocked: boolean,
  syncConfidence?: number,
): {
  label: string;
  color: string;
  icon: string;
} {
  if (!syncLocked) {
    return {
      label: "Searching",
      color: "#ff8000",
      icon: "⟲",
    };
  }

  if (syncConfidence === undefined || syncConfidence >= 0.75) {
    return {
      label: "Locked",
      color: "#00ff00",
      icon: "✓",
    };
  } else if (syncConfidence >= 0.5) {
    return {
      label: "Weak Lock",
      color: "#ffff00",
      icon: "~",
    };
  } else {
    return {
      label: "Unstable",
      color: "#ff8000",
      icon: "!",
    };
  }
}

/**
 * Data Segment Sync Monitor Component
 *
 * Displays real-time synchronization status for ATSC data segments
 * and field boundaries.
 */
export default function DataSegmentMonitor({
  syncLocked,
  segmentSyncCount,
  fieldSyncCount,
  syncConfidence,
  symbolsSinceSync,
  segmentLength = 832,
  showDetails = false,
}: DataSegmentMonitorProps): ReactElement {
  const status = useMemo(
    () => getSyncStatus(syncLocked, syncConfidence),
    [syncLocked, syncConfidence],
  );

  // Calculate sync timing progress
  const syncProgress = useMemo(() => {
    if (symbolsSinceSync === undefined) {
      return null;
    }
    return Math.min(1, symbolsSinceSync / segmentLength);
  }, [symbolsSinceSync, segmentLength]);

  // Estimate next field sync
  const segmentsUntilField = useMemo(() => {
    const FIELD_SYNC_SEGMENTS = 313;
    if (segmentSyncCount === 0) {
      return FIELD_SYNC_SEGMENTS;
    }
    return FIELD_SYNC_SEGMENTS - (segmentSyncCount % FIELD_SYNC_SEGMENTS);
  }, [segmentSyncCount]);

  return (
    <div
      style={{
        padding: "16px",
        backgroundColor: "#1a1f2e",
        borderRadius: "8px",
        color: "#e0e0e0",
        fontFamily: "monospace",
      }}
      role="region"
      aria-label="Data segment sync monitor"
    >
      <div style={{ marginBottom: "12px" }}>
        <h3
          style={{
            margin: "0 0 8px 0",
            fontSize: "14px",
            fontWeight: "bold",
            color: "#a0a0a0",
          }}
        >
          Sync Monitor
        </h3>
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          marginBottom: showDetails ? "16px" : "8px",
        }}
      >
        <div
          style={{
            fontSize: "32px",
            marginRight: "12px",
            color: status.color,
          }}
          aria-hidden="true"
        >
          {status.icon}
        </div>
        <div style={{ flex: 1 }}>
          <div
            style={{
              fontSize: "18px",
              fontWeight: "bold",
              color: status.color,
              marginBottom: "4px",
            }}
            aria-label={`Sync status: ${status.label}`}
          >
            {status.label}
          </div>
          {syncConfidence !== undefined && (
            <div
              style={{
                fontSize: "11px",
                color: "#808080",
              }}
            >
              Confidence: {(syncConfidence * 100).toFixed(0)}%
            </div>
          )}
        </div>
      </div>

      {/* Sync progress bar */}
      {syncProgress !== null && (
        <div
          style={{
            marginBottom: showDetails ? "16px" : "8px",
          }}
        >
          <div
            style={{
              fontSize: "11px",
              color: "#808080",
              marginBottom: "4px",
            }}
          >
            Next Segment Sync:
          </div>
          <div
            style={{
              width: "100%",
              height: "8px",
              backgroundColor: "#2a2f3e",
              borderRadius: "4px",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                width: `${syncProgress * 100}%`,
                height: "100%",
                backgroundColor: status.color,
                transition: "width 0.1s linear",
              }}
              aria-label={`Progress: ${(syncProgress * 100).toFixed(0)}%`}
            />
          </div>
          {symbolsSinceSync !== undefined && (
            <div
              style={{
                fontSize: "10px",
                color: "#606060",
                marginTop: "2px",
                textAlign: "right",
              }}
            >
              {symbolsSinceSync} / {segmentLength} symbols
            </div>
          )}
        </div>
      )}

      {showDetails && (
        <div
          style={{
            borderTop: "1px solid #2a2f3e",
            paddingTop: "12px",
            fontSize: "12px",
          }}
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "8px",
              marginBottom: "12px",
            }}
          >
            <div>
              <div style={{ color: "#808080" }}>Segment Syncs:</div>
              <div style={{ color: "#e0e0e0", fontWeight: "bold" }}>
                {segmentSyncCount.toLocaleString()}
              </div>
            </div>
            <div>
              <div style={{ color: "#808080" }}>Field Syncs:</div>
              <div style={{ color: "#e0e0e0", fontWeight: "bold" }}>
                {fieldSyncCount.toLocaleString()}
              </div>
            </div>
            <div>
              <div style={{ color: "#808080" }}>Segment Length:</div>
              <div style={{ color: "#e0e0e0", fontWeight: "bold" }}>
                {segmentLength} symbols
              </div>
            </div>
            <div>
              <div style={{ color: "#808080" }}>To Next Field:</div>
              <div style={{ color: "#e0e0e0", fontWeight: "bold" }}>
                {segmentsUntilField} segments
              </div>
            </div>
          </div>

          <div
            style={{
              padding: "8px",
              backgroundColor: "#141824",
              borderRadius: "4px",
              fontSize: "11px",
              color: "#808080",
            }}
          >
            <div style={{ marginBottom: "4px", fontWeight: "bold" }}>
              ATSC Sync Structure:
            </div>
            <div>• Segment: 832 symbols (4 sync + 828 data)</div>
            <div>• Field: 313 segments</div>
            <div>• Sync Pattern: [+5, -5, -5, +5]</div>
          </div>
        </div>
      )}
    </div>
  );
}
