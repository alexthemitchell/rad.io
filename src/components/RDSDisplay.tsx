/**
 * RDS Display Component
 *
 * Displays decoded RDS (Radio Data System) information in real-time:
 * - Station Name (PS - Program Service)
 * - Radio Text (RT - scrolling message)
 * - Program Type (PTY)
 * - PI Code (Program Identification)
 * - Signal Quality
 * - Other metadata (TP, TA, time)
 */

import { useEffect, useState, type ReactElement } from "react";
import { PTY_NAMES, formatPICode, getCountryFromPI } from "../models/RDSData";
import type { RDSStationData, RDSDecoderStats } from "../models/RDSData";

interface RDSDisplayProps {
  rdsData: RDSStationData | null;
  stats: RDSDecoderStats | null;
  className?: string;
}

/**
 * RDS Display Component
 */
export function RDSDisplay({
  rdsData,
  stats,
  className = "",
}: RDSDisplayProps): ReactElement {
  const [scrollPosition, setScrollPosition] = useState(0);

  // Auto-scroll radio text
  useEffect(() => {
    if (!rdsData?.rt || rdsData.rt.length <= 32) {
      return;
    }

    const interval = setInterval(() => {
      setScrollPosition((pos) => (pos + 1) % rdsData.rt.length);
    }, 300);

    return (): void => {
      clearInterval(interval);
    };
  }, [rdsData?.rt]);

  // No RDS data available
  if (rdsData?.pi === null || rdsData?.pi === undefined) {
    return (
      <div className={`rds-display rds-no-data ${className}`}>
        <div className="rds-status">
          <div className="rds-icon">📻</div>
          <div className="rds-message">No RDS Data</div>
          <div className="rds-hint">
            Tune to an FM station with RDS broadcasting
          </div>
        </div>
      </div>
    );
  }

  // Format radio text for scrolling
  const getDisplayText = (text: string, maxLength = 32): string => {
    if (!text || text.length <= maxLength) {
      return text.padEnd(maxLength, " ");
    }

    // Create scrolling effect
    const doubled = text + "  •  " + text;
    const start = scrollPosition % text.length;
    return doubled.substring(start, start + maxLength);
  };

  const syncStatus = stats?.syncLocked ? "Locked" : "Searching";
  const syncColor = stats?.syncLocked ? "#4ade80" : "#fbbf24";
  const qualityPercent = rdsData.signalQuality || 0;
  const getQualityColor = (quality: number): string => {
    if (quality > 80) {
      return "#4ade80";
    } else if (quality > 50) {
      return "#fbbf24";
    } else {
      return "#f87171";
    }
  };
  const qualityColor = getQualityColor(qualityPercent);

  return (
    <div className={`rds-display ${className}`}>
      {/* Header with PI and Quality */}
      <div className="rds-header">
        <div className="rds-pi">
          <span className="rds-label">PI:</span>
          <span className="rds-value">{formatPICode(rdsData.pi)}</span>
          <span className="rds-country">{getCountryFromPI(rdsData.pi)}</span>
        </div>
        <div className="rds-quality">
          <span className="rds-label">Quality:</span>
          <div className="rds-quality-bar">
            <div
              className="rds-quality-fill"
              style={{
                width: `${qualityPercent}%`,
                backgroundColor: qualityColor,
              }}
            />
          </div>
          <span className="rds-value">{qualityPercent}%</span>
        </div>
      </div>

      {/* Main Display - Station Name */}
      <div className="rds-main">
        <div className="rds-station-name">{rdsData.ps || "--------"}</div>
      </div>

      {/* Radio Text Display */}
      {rdsData.rt && (
        <div className="rds-radio-text">
          <div className="rds-rt-label">📝 Radio Text:</div>
          <div className="rds-rt-content">{getDisplayText(rdsData.rt, 48)}</div>
        </div>
      )}

      {/* Metadata Grid */}
      <div className="rds-metadata">
        <div className="rds-meta-item">
          <span className="rds-meta-label">Program Type:</span>
          <span className="rds-meta-value">
            {PTY_NAMES[rdsData.pty] || "Unknown"}
          </span>
        </div>

        <div className="rds-meta-item">
          <span className="rds-meta-label">Sync:</span>
          <span
            className="rds-meta-value"
            style={{ color: syncColor, fontWeight: "bold" }}
          >
            {syncStatus}
          </span>
        </div>

        {rdsData.tp && (
          <div className="rds-meta-item">
            <span className="rds-meta-label">Traffic:</span>
            <span className="rds-meta-value">
              {rdsData.ta ? "🚨 Announcement" : "✓ Available"}
            </span>
          </div>
        )}

        {rdsData.ct && (
          <div className="rds-meta-item">
            <span className="rds-meta-label">Time:</span>
            <span className="rds-meta-value">
              {rdsData.ct.toLocaleTimeString()}
            </span>
          </div>
        )}

        {rdsData.af.length > 0 && (
          <div className="rds-meta-item">
            <span className="rds-meta-label">Alt. Frequencies:</span>
            <span className="rds-meta-value">
              {rdsData.af.length} available
            </span>
          </div>
        )}
      </div>

      {/* Statistics Footer */}
      {stats && (
        <div className="rds-stats">
          <span className="rds-stat">
            Groups: {stats.validGroups}/{stats.totalGroups}
          </span>
          <span className="rds-stat">
            Error Rate: {stats.errorRate.toFixed(1)}%
          </span>
          {stats.correctedBlocks > 0 && (
            <span className="rds-stat">Corrected: {stats.correctedBlocks}</span>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Compact RDS Display (for sidebar or minimal view)
 */
export function RDSDisplayCompact({
  rdsData,
}: {
  rdsData: RDSStationData | null;
}): ReactElement {
  if (rdsData?.pi === null || rdsData?.pi === undefined) {
    return (
      <div className="rds-display-compact rds-no-data">
        <span className="rds-icon">📻</span>
        <span className="rds-text">No RDS</span>
      </div>
    );
  }

  return (
    <div className="rds-display-compact">
      <div className="rds-compact-ps">{rdsData.ps || "--------"}</div>
      {rdsData.rt && (
        <div
          className="rds-compact-rt"
          title={rdsData.rt}
          aria-label={rdsData.rt}
        >
          {rdsData.rt.substring(0, 24)}
          {rdsData.rt.length > 24 ? "..." : ""}
        </div>
      )}
      <div className="rds-compact-meta">
        {PTY_NAMES[rdsData.pty]} • {formatPICode(rdsData.pi)}
      </div>
    </div>
  );
}

export default RDSDisplay;
